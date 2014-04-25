require 'test_helper'

class SectionsControllerTest < ActionController::TestCase
  include Devise::TestHelpers

  setup do
    @laurel = create(:teacher)
    @laurel_section_1 = create(:section, :user => @laurel)
    @laurel_section_2 = create(:section, :user => @laurel)

    @chris = create(:teacher)
    @chris_section = create(:section, :user => @chris)

    @student = create(:user)
    @follower = Follower.create(:section => @laurel_section_1, :user => @laurel, :student_user => @chris)

    sign_in @laurel
  end

  test "should get new" do
    get :new

    assert assigns(:section)
    
    assert_response :success
  end

  test "should not get new if not signed in" do
    sign_out @laurel

    get :new

    assert_redirected_to_sign_in
  end

  test "should get new if not a teacher" do
    # hmmm, is this really what we want?
    sign_in @student

    get :new

    assert assigns(:section)
    
    assert_response :success
  end

  test "should create section" do
    assert_difference('Section.count') do
      post :create, :section => {:name => "Mrow"}
    end

    section = assigns(:section)
    assert_equal @laurel, section.user

    assert_redirected_to sections_path
  end

  test "should not create section if not signed in" do
    sign_out @laurel

    assert_no_difference('Section.count') do
      post :create, :section => {:name => "Mrow"}
    end

    assert_redirected_to_sign_in
  end

  test "should create section with the same name as another teacher" do
    assert_difference('Section.count') do
      post :create, :section => {:name => @chris_section.name}
    end

    section = assigns(:section)
    assert_equal @laurel, section.user
    assert_equal section.name, @chris_section.name

    assert_redirected_to sections_path
  end

  test "should not create section with blank name" do
    assert_no_difference('Section.count') do
      post :create, :section => {:name => ""}
    end

    section = assigns(:section)
    
    assert !section.valid?
    assert_equal ['can\'t be blank'], section.errors[:name]

    assert_response :success # yeah I know this is weird.. it's an http success
  end

  test "should not create section if teacher already has a section with name" do
    assert_no_difference('Section.count') do
      post :create, :section => {:name => @laurel_section_1.name}
    end

    # kind of pretends it worked...
    assert_redirected_to sections_path
  end


  test "should get edit" do
    get :edit, id: @laurel_section_1
    assert_response :success
  end
  
  test "should update section" do
    patch :update, id: @laurel_section_1, section: { :name => "Ha" }
    section = assigns(:section)

    assert_equal @laurel_section_1, section
    assert_equal "Ha", section.name

    assert_redirected_to sections_path
  end

  test "should not update section if not signed in" do
    sign_out @laurel

    patch :update, id: @laurel_section_1, section: { :name => "Ha" }

    assert_not_equal "Ha", @laurel_section_1.reload.name

    assert_redirected_to_sign_in
  end

  test "should not update section that belongs to another teacher" do
    patch :update, id: @chris_section, section: { :name => "Ha" }

    # not updated
    assert_not_equal "Ha", @laurel_section_1.reload.name

    assert flash.alert
    assert_redirected_to sections_path
  end


  test "should not update section if teacher already has a section with name" do
    patch :update, id: @laurel_section_2, section: { :name => @laurel_section_1.name }

    section = assigns(:section)
    
    assert !section.valid?
    assert_equal ['has already been taken'], section.errors[:name]

    assert_response :success # yeah I know this is weird.. it's an http success
  end

  test "should not update section with blank name" do
    patch :update, id: @laurel_section_2, section: { :name => "" }

    section = assigns(:section)
    
    assert !section.valid?
    assert_equal ['can\'t be blank'], section.errors[:name]

    assert_response :success # yeah I know this is weird.. it's an http success
  end

  test "should update section with the same name as another teacher's section" do
    patch :update, id: @laurel_section_2, section: { :name => @chris_section.name }
    section = assigns(:section)
    assert_redirected_to sections_path
  end
  
  test "should not update section owned by another teacher" do
    patch :update, id: @chris_section, section: { :name => "Ha" }
    section = assigns(:section)
    assert_redirected_to sections_path
  end

  test "should destroy section" do
    assert_equal @laurel_section_1, @follower.section

    assert_difference('Section.count', -1) do
      delete :destroy, id: @laurel_section_1
    end

    # followers are removed from section
    @follower = @follower.reload
    assert_equal nil, @follower.section
    assert_equal nil, @follower.section_id

    assert_redirected_to sections_path
  end
end
