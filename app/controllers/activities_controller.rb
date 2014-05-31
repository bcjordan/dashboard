class ActivitiesController < ApplicationController
  include LevelsHelper

  protect_from_forgery except: :milestone
  check_authorization except: [:milestone]
  load_and_authorize_resource except: [:milestone]
  before_filter :nonminimal, :only => :milestone

  before_action :set_activity, only: [:show, :edit, :update, :destroy]
  
  MAX_INT_MILESTONE = 2147483647

  def milestone_logger
    @@milestone_logger ||= Logger.new("#{Rails.root}/log/milestone.log")
  end

  def track_progress_for_user
    authorize! :create, Activity
    authorize! :create, UserLevel

    test_result = params[:testResult].to_i
    solved = ('true' == params[:result])
    lines = params[:lines].to_i
    
    @activity = Activity.create!(user: current_user,
                                 level: @script_level.level,
                                 action: solved, # TODO I think we don't actually use this. (maybe in a report?)
                                 test_result: test_result,
                                 attempt: params[:attempt].to_i,
                                 lines: lines,
                                 time: [[params[:time].to_i, 0].max, MAX_INT_MILESTONE].min,
                                 level_source: @level_source )


    retryable on: Mysql2::Error, matching: /Duplicate entry/ do # catch race conditions in first_or_create
      user_level = UserLevel.where(user: current_user, level: @script_level.level).first_or_create

      user_level.attempts += 1 unless user_level.best?
      user_level.best_result = user_level.best_result ?
        [test_result, user_level.best_result].max :
        test_result
      user_level.save!
    end

    passed = Activity.passing?(test_result)
    if lines > 0 && passed
      current_user.total_lines += lines
      current_user.save!
    end

    if params[:save_to_gallery] && @level_source_image && solved
      @gallery_activity = GalleryActivity.create!(user: current_user, activity: @activity)
    end

    begin
      trophy_check(current_user) if passed
    rescue Exception => e
      Rails.logger.error "Error updating trophy exception: #{e.inspect}"
    end
    
    unless @trophy_updates.blank?
      prize_check(current_user)
    end
  end

  def track_progress_in_session
    # TODO: this doesn't work for multiple scripts, especially if scripts share levels

    # hash of level_id => test_result
    test_result = params[:testResult].to_i
    session[:progress] ||= {}
    if test_result > session[:progress].fetch(@script_level.level_id, -1)
      session[:progress][@script_level.level_id] = test_result
    end

    # counter of total lines written
    session[:lines] ||= 0
    lines = params[:lines].to_i
    if lines > 0 && Activity.passing?(test_result)
      session[:lines] += lines
    end
  end

  def milestone
    # TODO: do we use the :result and :testResult params for the same thing?
    solved = ('true' == params[:result])
    @script_level = ScriptLevel.cache_find(params[:script_level_id].to_i)

    if params[:program]
      @level_source = LevelSource.lookup(@script_level.level, params[:program])
    end

    log_milestone(@level_source, params)

    # Store the image only if the image is set, and the image has not been saved
    if params[:image]
      @level_source_image = LevelSourceImage.find_or_create_by(:level_source_id => @level_source.id)
      @level_source_image.replace_image_if_better Base64.decode64(params[:image])
    end

    if current_user
      track_progress_for_user
    else
      track_progress_in_session
    end
    
    total_lines = if current_user && current_user.total_lines
                    current_user.total_lines
                  elsif session[:lines]
                    session[:lines]
                  else
                    0
                  end

    render json: milestone_response(script_level: @script_level,
                                    total_lines: total_lines,
                                    trophy_updates: @trophy_updates,
                                    solved?: solved,
                                    level_source: @level_source,
                                    activity: @activity)

    slog(:tag => 'activity_finish',
         :script_level_id => @script_level.id,
         :user_agent => request.user_agent,
         :locale => locale)
  end

  # GET /activities
  # GET /activities.json
  def index
    @activities = Activity.all
  end

  # GET /activities/1
  # GET /activities/1.json
  def show
  end

  # GET /activities/new
  def new
    @activity = Activity.new
  end

  # GET /activities/1/edit
  def edit
  end

  # POST /activities
  # POST /activities.json
  def create
    @activity = Activity.new(activity_params)

    respond_to do |format|
      if @activity.save
        format.html { redirect_to @activity, notice: I18n.t('crud.created', model: Activity.model_name.human) }
        format.json { render action: 'show', status: :created, location: @activity }
      else
        format.html { render action: 'new' }
        format.json { render json: @activity.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /activities/1
  # PATCH/PUT /activities/1.json
  def update
    respond_to do |format|
      if @activity.update(activity_params)
        format.html { redirect_to @activity, notice: I18n.t('crud.updated', model: Activity.model_name.human) }
        format.json { head :no_content }
      else
        format.html { render action: 'edit' }
        format.json { render json: @activity.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /activities/1
  # DELETE /activities/1.json
  def destroy
    @activity.destroy
    respond_to do |format|
      format.html { redirect_to activities_url }
      format.json { head :no_content }
    end
  end

  def trophy_check(user)
    @trophy_updates ||= []
    # called after a new activity is logged to assign any appropriate trophies
    current_trophies = user.user_trophies.includes([:trophy, :concept]).index_by { |ut| ut.concept }
    progress = user.concept_progress

    progress.each_pair do |concept, counts|
      current = current_trophies[concept]
      pct = counts[:current].to_f/counts[:max]

      new_trophy = Trophy.find_by_id case
        when pct == Trophy::GOLD_THRESHOLD
          Trophy::GOLD
        when pct >= Trophy::SILVER_THRESHOLD
          Trophy::SILVER
        when pct >= Trophy::BRONZE_THRESHOLD
          Trophy::BRONZE
        else
          # "no trophy earned"
      end

      if new_trophy
        if new_trophy.id == current.try(:trophy_id)
          # they already have the right trophy
        elsif current
          current.update_attributes!(trophy_id: new_trophy.id)
          @trophy_updates << [data_t('concept.description', concept.name), new_trophy.name, view_context.image_path(new_trophy.image_name)]
        else
          UserTrophy.create!(user: user, trophy_id: new_trophy.id, concept: concept)
          @trophy_updates << [data_t('concept.description', concept.name), new_trophy.name, view_context.image_path(new_trophy.image_name)]
        end
      end
    end
  end

  def prize_check(user)
    if user.trophy_count == (Concept.cached.length * Trophy::TROPHIES_PER_CONCEPT)
      if !user.prize_earned
        user.prize_earned = true
        user.save!
        # student prizes disabled
        # PrizeMailer.prize_earned(user).deliver if user.email.present? && eligible_for_prize?
      end

      # for awarding prizes, we only honor the first (primary) teacher
      teacher = user.valid_prize_teacher

      if teacher && (!teacher.teacher_prize_earned || !teacher.teacher_bonus_prize_earned)
        t_prize, t_bonus = teacher.check_teacher_prize_eligibility
        if t_prize && !teacher.teacher_prize_earned
          teacher.teacher_prize_earned = true
          teacher.save!
          PrizeMailer.teacher_prize_earned(teacher).deliver if teacher.email.present? && eligible_for_prize?
        end

        if t_bonus && !teacher.teacher_bonus_prize_earned
          teacher.teacher_bonus_prize_earned = true
          teacher.save!
          PrizeMailer.teacher_bonus_prize_earned(teacher).deliver if teacher.email.present? && eligible_for_prize?
        end
      end
    end
  end

  private
  # Use callbacks to share common setup or constraints between actions.
  def set_activity
    @activity = Activity.find(params[:id])
  end

  # Never trust parameters from the scary internet, only allow the white list through.
  def activity_params
    params[:activity]
  end

  def log_milestone(level_source, params)
    log_string = "Milestone Report:"
    if (current_user || session.id)
      log_string += "\t#{(current_user ? current_user.id.to_s : ("s:" + session.id))}"
    else
      log_string += "\tanon"
    end
    log_string += "\t#{request.remote_ip}\t#{params[:app]}\t#{params[:level]}\t#{params[:result]}" +
                  "\t#{params[:testResult]}\t#{params[:time]}\t#{params[:attempt]}\t#{params[:lines]}"
    log_string += level_source.present? ? "\t#{level_source.id.to_s}" : "\t"
    log_string += "\t#{request.user_agent}"

    milestone_logger.info log_string
  end
end
