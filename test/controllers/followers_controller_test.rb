require 'test_helper'

class FollowersControllerTest < ActionController::TestCase
  setup do
    @laurel = create(:teacher)
    @laurel_section_1 = create(:section, user: @laurel)
    @laurel_section_2 = create(:section, user: @laurel)

    # add a few students to a section
    create(:follower, section: @laurel_section_1)
    create(:follower, section: @laurel_section_1)

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

  test "remove from section" do
    Follower.create!(user: @laurel, student_user: @student, section: @laurel_section_1)

    assert_difference('@laurel_section_1.reload.followers.count', -1) do
      post :remove_from_section, section_id: @laurel_section_1.id, follower_id: @student.id
    end

    assert_redirected_to manage_followers_path
  end


  test "remove from section pretends to succeed when user has already been removed" do
    assert_no_difference('@laurel_section_1.reload.followers.count') do # not actually removing anything
      post :remove_from_section, section_id: @laurel_section_1.id, follower_id: @student.id
    end

    assert_redirected_to manage_followers_path
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

end
