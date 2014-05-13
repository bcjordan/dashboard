class ScriptLevelsController < ApplicationController
  check_authorization
  before_filter :authenticate_user!, :only => [:solution]
  include LevelsHelper

  def solution
    authorize! :show, ScriptLevel
    if current_user.teacher? || current_user.admin?
      @level = Level.find(params[:level_id])
      source = LevelSource.find_by_id(@level.ideal_level_source_id)
      @start_blocks = source ? source.data : ''
      @game = @level.game
      @full_width = true
      @share = true
      @level_source_id = @level.ideal_level_source_id
      render 'level_sources/show'
    else
      flash[:alert] = I18n.t('reference_area.auth_error')
      redirect_to root_path
    end
  end

  def show
    authorize! :show, ScriptLevel
    @script = Script.get_from_cache(params[:script_id])

    chapter = params[:chapter]
    script_level_id = params[:id]
    reset = params[:reset]

    if reset
      # reset is a special mode which will delete the session if the user is not signed in
      # and start them at the beginning of the script.
      # If the user is signed in, continue normally
      reset_session if !current_user
      redirect_to build_script_level_path(@script.script_levels.first) # TODO: we don't really specify order, this just happens to work
      return
    end

    if ScriptLevel::NEXT == (chapter || script_level_id)
      if current_user
        redirect_to build_script_level_path(current_user.try(:next_untried_level, @script) || @script.script_levels.first)
      else
        session_progress = session[:progress] || {}

        @script.script_levels.each do |sl|
          if session_progress.fetch(sl.level_id, -1) < Activity::MINIMUM_PASS_RESULT
            redirect_to build_script_level_path(sl)
            break
          end
          if sl.level_id == @script.script_levels.last.level_id
            # all levels complete - resume at first level
            redirect_to build_script_level_path(@script.script_levels.first)
          end
        end
      end
      return
    end

    if chapter
      @script_level = @script.get_script_level_by_chapter(chapter.to_i)
    elsif params[:stage_id]
      @script_level = @script.get_script_level_by_stage_and_position(params[:stage_id], params[:id])
    else
      @script_level = @script.get_script_level_by_id(script_level_id.to_i)
    end
    raise ActiveRecord::RecordNotFound unless @script_level

    canonical_path = build_script_level_path(@script_level)
    
    if request.path != canonical_path
      redirect_to canonical_path, status: :moved_permanently
      return
    end

    present_level(@script_level)

    # TODO should we filter out robot user agents?
    slog(:tag => 'activity_start',
         :script_level_id => @script_level.id,
         :user_agent => request.user_agent,
         :locale => locale)
  end

private

  def present_level(script_level)
    @level = script_level.level
    @game = @level.game
    @stage = script_level.stage

    set_videos_and_blocks_and_callouts

    @callback = milestone_url(user_id: current_user.try(:id) || 0, script_level_id: @script_level)
    @full_width = true
    @fallback_response = {
      success: milestone_response(script_level: @script_level, solved?: true),
      failure: milestone_response(script_level: @script_level, solved?: false)
    }
    render 'levels/show', formats: [:html]
  end
end
