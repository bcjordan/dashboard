require 'test_helper'

class UsersControllerTest < ActionController::TestCase
  setup do
    @teacher = create(:teacher)
    @teacher_section = create(:section, :user => @teacher)

    @student = create(:user)
    @follower = Follower.create(:section => @teacher_section, :user => @teacher, :student_user => @student)

    @other_student = create(:user)
  end

  test "cannot show if not signed in" do
    get :show, id: @teacher
    
    assert_redirected_to_sign_in
  end

  test "cannot show if not teacher" do
    sign_in @student

    get :show, id: @teacher
    
    assert_response :forbidden
  end

  test "teacher cannot show student that is not their student" do
    sign_in @teacher

    get :show, id: @other_student

    assert_response :forbidden
  end

  test "teacher can show student" do
    sign_in @teacher

    get :show, id: @student
  end


  test "teacher can show self" do # why not...
    sign_in @teacher

    get :show, id: @teacher
  end


end
