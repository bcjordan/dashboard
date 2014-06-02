class TeacherController < ApplicationController
  before_filter :authenticate_user!
  before_filter :authenticate_teacher!

  def index
    @sections = current_user.sections.order('name')
  end

  protected

  def authenticate_teacher!
    authorize! :manage, :teacher
  end

end
