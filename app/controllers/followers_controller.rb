class FollowersController < ApplicationController
  before_filter :authenticate_user!, except: [:student_user_new, :student_register]
  check_authorization only: [:index, :create, :manage, :sections]
  load_and_authorize_resource only: [:index, :create, :manage, :sections]

  def index
    script = Script.twenty_hour_script
    @section_map = Hash.new{ |h,k| h[k] = [] }
    students = current_user.followers.includes([:section, { student_user: [{ user_trophies: [:concept, :trophy] }, :user_levels] }])
    students = students.where(['section_id = ?', params[:section_id].to_i]) if params[:section_id].to_i > 0
    students.each do |f|
      @section_map[f.section] << f.student_user
    end

    @all_script_levels = script.script_levels.includes({ level: :game })
    @all_script_levels = @all_script_levels.where(['levels.game_id = ?', params[:game_id].to_i]) if params[:game_id].to_i > 0
    @all_concepts = Concept.cached

    @all_games = Game.where(['id in (select game_id from levels l inner join script_levels sl on sl.level_id = l.id where sl.script_id = ?)', script.id])
  end

  def create
    redirect_url = params[:redirect] || root_path

    if params[:section_code].blank?
      redirect_to redirect_url, alert: I18n.t('follower.error.blank_code')
      return
    end

    unless @section = Section.find_by_code(params[:section_code])
      redirect_to redirect_url, alert: I18n.t('follower.error.section_not_found', section_code: params[:section_code])
      return
    end

    teacher = @section.user

    retryable on: Mysql2::Error, matching: /Duplicate entry/ do # catch race conditions in first_or_create
      @follower = Follower.where(user: teacher, student_user: current_user, section: @section).first_or_create!
    end

    # if the teacher has not confirmed their email, they should be sent email confirmation instrutions
    teacher.send_confirmation_instructions if !teacher.confirmed?

    redirect_to redirect_url, notice: I18n.t('follower.added_teacher', name: teacher.name)
  end

  def manage
    @followers = current_user.followers.order('users.name').includes([:student_user, :section])
    @sections = current_user.sections.order('name')
  end

  def sections
    @sections = current_user.sections.order('name')
  end

  def add_to_section
    if params[:follower_ids]
      if params[:section_id] && params[:section_id] != "NULL"
        section = Section.find(params[:section_id])
        raise "not owner of that section" if section.user_id != current_user.id
      else
        section = nil
      end
      
      Follower.connection.execute(<<SQL)
update followers
set section_id = #{section.nil? ? 'NULL' : section.id}
where id in (#{params[:follower_ids].map(&:to_i).join(',')})
  and user_id = #{current_user.id}
SQL
      redirect_to manage_followers_path, notice: "Updated class assignments"
    else
      redirect_to manage_followers_path, notice: "No students selected"
    end
  end

  def remove
    @user = User.find(params[:student_user_id])
    @teacher = User.find(params[:teacher_user_id])

    raise "not found" if !@user || !@teacher
    
    removed_by_student = @user.id == current_user.id

    redirect_url = removed_by_student ? root_path : manage_followers_path

    f = Follower.find_by_user_id_and_student_user_id(@teacher, @user)
    
    if !f.present?
      redirect_to redirect_url, alert: t('teacher.user_not_found')
    else
      authorize! :destroy, f
      if @user.email.present? || @user.teachers.count > 1
        # if this was the student's first teacher, store that teacher id in the student's record
        @user.update_attributes(:prize_teacher_id => @teacher.id) if @user.teachers.first.try(:id) == @teacher.id && @user.prize_teacher_id.blank?
        
        f.delete
        FollowerMailer.student_disassociated_notify_teacher(@teacher, @user).deliver if removed_by_student
        FollowerMailer.teacher_disassociated_notify_student(@teacher, @user).deliver if !removed_by_student
        redirect_to redirect_url, notice: t('teacher.student_teacher_disassociated', teacher_name: @teacher.name, student_name: @user.name)
      else
        # we can't allow the student to be removed because they don't have an email address and they only have one teacher
        # that teacher is needed to allow them to reset their password since we can't send them a password reset link
        redirect_to redirect_url, alert: t(removed_by_student ? 'teacher.cant_remove_teacher_no_email' : 'teacher.cant_remove_student_no_email', teacher_name: @teacher.name, student_name: @user.name)
      end
    end
  end

  def student_user_new
    @section = Section.find_by_code(params[:section_code])

    # make sure section_code is in the path (rather than just query string)
    if request.path != student_user_new_path(section_code: params[:section_code])
      redirect_to student_user_new_path(section_code: params[:section_code])
    elsif current_user && @section
      if current_user == @section.user
        redirect_to root_path, alert: I18n.t('follower.error.cant_join_own_section') and return
      end

      follower_same_user_teacher = current_user.followeds.where(:user_id => @section.user_id).first
      if follower_same_user_teacher.present?
        follower_same_user_teacher.update_attributes!(:section_id => @section.id)
      else
        Follower.create!(user_id: @section.user_id, student_user: current_user, section: @section)
      end
      redirect_to root_path, notice: I18n.t('follower.registered', section_name: @section.name) and return
    end

    @user = User.new
  end

  def student_register
    @section = Section.find_by_code(params[:section_code])
    student_params = params[:user].permit([:username, :name, :password, :gender, :age, :parent_email])

    @user = User.new(student_params)

    if current_user
      @user.errors.add(:username, "Please signout before proceeding")
    else
      if User.find_by_username(@user.username)
        @user.errors.add(:username, I18n.t('follower.error.username_in_use', username: @user.username))
      else
        @user.provider = User::PROVIDER_MANUAL
        @user.user_type = User::TYPE_STUDENT
        if @user.save
          Follower.create!(user_id: @section.user_id, student_user: @user, section: @section)
          # todo: authenticate new user
          redirect_to root_path, notice: I18n.t('follower.registered', section_name: @section.name)
          sign_in(:user, @user)
          return
        end
      end
    end

    render "student_user_new", formats: [:html]
  end

  def student_edit_password
    @user = User.find(params[:user_id])
    return if writable_student?(@user)
  end

  def student_update_password
    user_params = params[:user]
    @user = User.find(user_params[:id])
    return if writable_student?(@user)

    if @user.update(user_params.permit(:password, :password_confirmation))
      redirect_to manage_followers_path, notice: "Password saved"
    else
      render :student_edit_password, formats: [:html]
    end
  end

private
  def writable_student?(user)
    # I'd like to do it with authorize!, but don't want to preload students on every request in ability.rb
    # authorize! :update, @user
    unless user.writable_by?(current_user)
      redirect_to root_path, notice: I18n.t('reports.error.access_denied')
    end
  end
end
