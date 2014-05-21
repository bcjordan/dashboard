require 'test_helper'

class TeacherControllerTest < ActionController::TestCase

  def setup
    @teacher = create(:teacher)
    @student = create(:student_user)
  end

  test "teacher can see index page" do
    sign_in @teacher

    get :index

    assert_response :success
  end

  test "students cannot see teacher page" do
    sign_in @student

    get :index

    assert_response :forbidden
  end

  test "anonymous cannot see teacher page" do
    get :index

    assert_redirected_to_sign_in
  end
  
end
