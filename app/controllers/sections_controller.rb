class SectionsController < ApplicationController
  before_filter :authenticate_user!
  check_authorization
  load_and_authorize_resource

  before_action :set_section, only: [:show, :edit, :update, :destroy]

  def index
    @sections = current_user.sections.order('name')
  end
  
  def show
    if @section.followers.empty?
      redirect_to edit_students_section_path(@section)
    end

    script = Script.twenty_hour_script

    @section_map = { @section => @section.students } # include { student_user: [{ user_trophies: [:concept, :trophy] }, :user_levels] }])

    @all_script_levels = script.script_levels.includes({ level: :game })
    @all_concepts = Concept.cached

    @all_games = Game.where(['id in (select game_id from levels l inner join script_levels sl on sl.level_id = l.id where sl.script_id = ?)', script.id])
  end

  def new
    @section = Section.new
  end

  def edit
  end

  def edit_students
    @followers = current_user.followers.
      where(section: @section).
      order('users.name').
      includes([:student_user, :section])
  end

  def update_students
    filtered_section_params = section_params

    # remove blank form rows
    filtered_section_params[:students_attributes].reject! {|student| student.values.all?(&:blank?)}

    # add provider::manual so email is not required
    filtered_section_params[:students_attributes].each do |student|
      student[:provider] = User::PROVIDER_MANUAL
    end

    respond_to do |format|
      if @section.update(filtered_section_params)
        format.html { redirect_to edit_students_section_path(@section),
            notice: I18n.t('crud.updated', model: Section.model_name.human) }
      else
        format.html { render action: 'edit_students' }
      end
    end
  end

  def create
    # this will quietly do nothing if this section already exists
    @section = Section.where(user: current_user, name: section_params[:name]).first_or_create

    respond_to do |format|
      if @section.save
        format.html { redirect_to sections_followers_path, notice: I18n.t('crud.created', model: Section.model_name.human) }
      else
        format.html { render action: 'new' }
      end
    end
  end

  def update
    respond_to do |format|
      if @section.update(section_params)
        format.html { redirect_to sections_followers_path, notice: I18n.t('crud.updated', model: Section.model_name.human) }
      else
        format.html { render action: 'edit' }
      end
    end
  end


  def destroy
    @section.destroy
    
    respond_to do |format|
      format.html { redirect_to sections_followers_path, notice: I18n.t('crud.destroyed', model: Section.model_name.human) }
    end
  end

  private
  # Use callbacks to share common setup or constraints between actions.
  def set_section
    @section = Section.find(params[:id])

    if @section
      if !current_user.admin? && (!@section.user || (@section.user != current_user))
        # TODO use cancan
        flash[:alert] = I18n.t('crud.access_denied', model: Section.model_name.human)
        redirect_to sections_followers_path
        return
      end
    end
  end

  # Never trust parameters from the scary internet, only allow the white list through.
  def section_params
    params.require(:section).permit(:name, students_attributes: [:name, :username, :password, :provider])
  end
end
