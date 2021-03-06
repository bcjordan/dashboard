require 'test_helper'

class RegistrationsControllerTest < ActionController::TestCase

  setup do
    @request.env["devise.mapping"] = Devise.mappings[:user]
  end

  test "new" do
    get :new
    assert_response :success
  end

  test "create as student with age" do
    Timecop.travel Time.local(2013, 9, 1, 12, 0, 0) do
      student_params = {name: "A name",
                        password: "apassword",
                        email: 'an@email.address',
                        gender: 'F',
                        age: '13',
                        user_type: 'student'}
      
      assert_creates(User) do
        post :create, user: student_params
      end

      assert_redirected_to '/'

      assert_equal 'A name', assigns(:user).name
      assert_equal 'F', assigns(:user).gender
      assert_equal Date.today - 13.years, assigns(:user).birthday
      assert_equal nil, assigns(:user).provider
      assert_equal User::TYPE_STUDENT, assigns(:user).user_type
      assert_equal 'an@email.address', assigns(:user).email
    end
  end

  test "create as student without age" do
    student_params = {name: "A name",
                      password: "apassword",
                      email: 'an@email.address',
                      gender: 'F',
                      age: '',
                      user_type: 'student'}
    
    assert_creates(User) do
      post :create, user: student_params
    end

    assert_redirected_to '/'

    assert_equal nil, assigns(:user).birthday
  end


  test "create as student requires email" do
    student_params = {name: "A name",
                      password: "apassword",
                      email: nil,
                      user_type: 'student'}
    
    assert_does_not_create(User) do
      post :create, user: student_params
    end
  end

  test "update student with age" do
    Timecop.travel Time.local(2013, 9, 1, 12, 0, 0) do
      student = create :student_user, birthday: '1981/03/24'

      sign_in student

      post :update, user: {age: 9}
    
      assert_equal Date.today - 9.years, assigns(:user).birthday
    end
  end

end
