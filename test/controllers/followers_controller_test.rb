require 'test_helper'

class FollowersControllerTest < ActionController::TestCase
  setup do
    @laurel = create(:teacher)
    @laurel_section_1 = create(:section, user: @laurel)
    @laurel_section_2 = create(:section, user: @laurel)

    # add a few students to a section
    @laurel_student_1 = create(:follower, section: @laurel_section_1)
    @laurel_student_2 = create(:follower, section: @laurel_section_1)

    @chris = create(:teacher)
    @chris_section = create(:section, user: @chris)

    # student without section or teacher
    @student = create(:user)

    sign_in @laurel
  end

  test "should show index" do
    get :index
    assert_response :success

    assert !assigns(:section_map).empty?
  end

  test "should not show index if not teacher" do
    sign_in @student

    get :index
    assert_response :forbidden
  end

  test "should show manage" do
    get :manage
    assert_response :success

    assert_equal [@laurel_section_1, @laurel_section_2], assigns(:sections)
    assert_equal [@laurel_student_1, @laurel_student_2], assigns(:followers)
  end

  test "should not show manage if not teacher" do
    sign_in @student

    get :manage
    assert_response :forbidden
  end

  test "should show sections" do
    get :sections
    assert_response :success

    assert_equal [@laurel_section_1, @laurel_section_2], assigns(:sections)
  end

  test "should not show sections if not teacher" do
    sign_in @student

    get :sections
    assert_response :forbidden
  end


  test "student_user_new" do
    sign_out @laurel

    get :student_user_new, section_code: @chris_section.code

    assert_response :success
    assert assigns(:user)
    
    assert ! assigns(:user).persisted?
  end


  test "student_register with age" do
    Timecop.travel Time.local(2013, 9, 1, 12, 0, 0) do
      sign_out @laurel

      student_params = {username: 'student1',
                        name: "A name",
                        password: "apassword",
                        gender: 'F',
                        age: '13'}
      
      assert_creates(User, Follower) do
        post :student_register, section_code: @chris_section.code, user: student_params
      end

      assert_redirected_to '/'

      assert_equal 'student1', assigns(:user).username
      assert_equal 'A name', assigns(:user).name
      assert_equal 'F', assigns(:user).gender
      assert_equal Date.today - 13.years, assigns(:user).birthday
      assert_equal 'manual', assigns(:user).provider
      assert_equal User::TYPE_STUDENT, assigns(:user).user_type
    end
  end

  test "create with section code" do
    sign_in @student

    assert_creates(Follower) do
      post :create, section_code: @laurel_section_1.code, redirect: '/'
    end

    follower = Follower.last

    assert_equal @laurel_section_1, follower.section 
    assert_equal @laurel, follower.user
    assert_equal @student, follower.student_user

    assert_redirected_to '/'
    assert_equal "#{@laurel.name} added as your teacher", flash[:notice]
  end

  test "create with invalid section code gives error message" do
    sign_in @student

    assert_does_not_create(Follower) do
      post :create, section_code: '2323232', redirect: '/'
    end

    assert_redirected_to '/'
    assert_equal "Could not find a section with code '2323232'.", flash[:alert]
  end

  test "create without section code gives error message" do
    sign_in @student

    assert_does_not_create(Follower) do
      post :create, redirect: '/'
    end

    assert_redirected_to '/'
    assert_equal "Please enter a section code", flash[:alert]
  end

  test "student can remove teacher" do
    follower = @laurel_student_1

    sign_in follower.student_user

    assert_difference('Follower.count', -1) do
      post :remove, student_user_id: follower.student_user.id, teacher_user_id: follower.user_id
    end

    assert !Follower.exists?(follower.id)
  end

  test "teacher can remove student" do
    follower = @laurel_student_1

    sign_in follower.user

    assert_difference('Follower.count', -1) do
      post :remove, student_user_id: follower.student_user_id, teacher_user_id: follower.user_id
    end

    assert !Follower.exists?(follower.id)
  end

  test "student cannot remove other student" do
    follower = @laurel_student_1

    sign_in @student

    assert_no_difference('Follower.count') do
      post :remove, student_user_id: follower.student_user_id, teacher_user_id: follower.user_id
    end
    assert_response :forbidden
    assert follower.reload # not deleted
  end

end
