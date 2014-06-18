require 'test_helper'

class ReportsControllerTest < ActionController::TestCase
  include Devise::TestHelpers

  setup do
    @admin = create(:admin)
    sign_in(@admin)

    @not_admin = create(:user, username: 'notadmin')

    @script = create(:script, name: 'Report Script')
    @stage = create(:stage, script: @script, name: 'Report Stage 1')
    @stage2 = create(:stage, script: @script, name: 'Report Stage 2')
    @script_level = create(:script_level, script: @script, stage: @stage)
    @script_level2 = create(:script_level, script: @script, stage: @stage2)
    @script_level.move_to_bottom
    @script_level2.move_to_bottom

    @teacher = create(:teacher)
    @teacher_section = create(:section, :user => @teacher)

    @student = create(:user)
    @follower = Follower.create(:section => @teacher_section, :user => @teacher, :student_user => @student)

    @other_student = create(:user)
  end

  test "should setup properly" do
    assert_equal @script_level.script, @script_level2.script
  end

  test "should get user_stats" do
    get :user_stats, :user_id => @not_admin.id
    assert_response :success
  end

  test "should not get user_stats if not signed in" do
    sign_out @admin
    get :user_stats, :user_id => @not_admin.id

    assert_redirected_to_sign_in
  end

  test "should get user_stats for yourself if not admin" do
    sign_in @not_admin

    get :user_stats, :user_id => @not_admin.id

    assert_response :success
  end

  test "should get user_stats for students if teacher" do
    sign_in @teacher

    get :user_stats, :user_id => @student.id

    assert_response :success
  end

  test "should not get user_stats for other users if not admin" do
    sign_in create(:user)

    get :user_stats, :user_id => @not_admin.id

    assert_response :forbidden
  end

  test "should have two game groups if two stages" do
    get :header_stats, script_id: @script_level.script.id, user_id: @not_admin.id
    css = css_select "div.game-group"
    assert_equal 2, css.count
  end

  test "should have one game group if one stage" do
    @script_level2.update(stage: @stage)
    @script_level2.move_to_bottom

    get :user_stats, script_id: @script_level.script.id, user_id: @not_admin.id
    css = css_select "div.game-group"
    assert_equal 1, css.count
  end

  test "should return 20h curriculum by default" do
    get :user_stats, user_id: @not_admin.id
    css = css_select "div.game-group"
    assert_equal 20, css.count
  end


  test "should get usage" do
    get :usage, :user_id => @not_admin.id
    assert_response :success
  end

  test "should not get usage if not signed in" do
    sign_out @admin
    get :usage, :user_id => @not_admin.id

    assert_redirected_to_sign_in
  end

  test "should get usage for yourself if not admin" do
    sign_in @not_admin

    get :usage, :user_id => @not_admin.id

    assert_response :success
  end


  test "should get usage for students if teacher" do
    sign_in @teacher

    get :usage, :user_id => @student.id

    assert_response :success
  end

  test "should not get usage for other users if not admin or teacher" do
    sign_in create(:user)

    get :usage, :user_id => @not_admin.id

    assert_response :forbidden
  end

  test "should get header_stats" do
    get :header_stats
    assert_response :success
  end

  test "should get header_stats if not signed in" do
    sign_out @admin
    get :header_stats
    assert_response :success
  end

  test "should get prizes" do
    get :prizes
    assert_response :success
  end

  test "should get prizes if not admin" do
    sign_in @not_admin
    get :prizes
    assert_response :success
  end

  test "should not get prizes if not signed in" do
    sign_out @admin
    get :prizes

    assert_redirected_to_sign_in
  end

  generate_admin_only_tests_for :all_usage

  generate_admin_only_tests_for :admin_stats

  generate_admin_only_tests_for :admin_gallery

  test "admin_gallery shows most recent 25 gallery items" do
    sign_in @admin

    100.times do
      create(:gallery_activity)
    end

    get :admin_gallery

    assert_equal 25, assigns(:gallery_activities).count
  end

  test "should get students" do
    get :students
    assert_response :success
  end

  test "should get students if not admin" do
    sign_in @not_admin
    get :students
    assert_response :success
  end

  test "should not get students if not signed in" do
    sign_out @admin
    get :students

    assert_redirected_to_sign_in
  end


  test "should get level_stats" do
    get :level_stats, {:level_id => create(:level).id}
    assert_response :success
  end

  test "should not get level_stats if not admin" do
    sign_in @not_admin
    get :level_stats, {:level_id => create(:level).id}
    assert_response :forbidden
  end

  test "should not get level_stats if not signed in" do
    sign_out @admin
    get :level_stats, {:level_id => create(:level).id}

    assert_redirected_to_sign_in
  end

  generate_admin_only_tests_for :assume_identity_form

  test "should assume_identity" do
    post :assume_identity, {:user_id => @not_admin.id}
    assert_redirected_to '/'

    assert_equal @not_admin.id, session['warden.user.user.key'].first.first
  end

  test "should assume_identity by username" do
    post :assume_identity, {:user_id => @not_admin.username}
    assert_redirected_to '/'

    assert_equal @not_admin.id, session['warden.user.user.key'].first.first
  end

  test "should assume_identity by email" do
    post :assume_identity, {:user_id => @not_admin.email}
    assert_redirected_to '/'

    assert_equal @not_admin.id, session['warden.user.user.key'].first.first
  end

  test "should assume_identity error if not found" do
    post :assume_identity, {:user_id => 'asdkhaskdj'}
    
    assert_response :success

    assert flash[:error]
  end

  test "should not assume_identity if not admin" do
    sign_in @not_admin
    post :assume_identity, {:user_id => @admin.id}
    assert_response :forbidden
    assert_equal @not_admin.id, session['warden.user.user.key'].first.first # no change
  end

  test "should not assume_identity if not signed in" do
    sign_out @admin
    post :assume_identity, {:user_id => @admin.id}

    assert_redirected_to_sign_in
  end

  # 'report-stage-1' instead of 'report-stage-1: Report Stage 1'
  test "should render single stage name for custom script" do
    # first script has 1 stage, second script has 2 stages
    create(:script_level, script: @script, stage: @stage2)
    get :header_stats, script_id: @script.id
    # render string from test translation data
    assert_select 'div.stage', 2
    assert_select 'div.stage', /\Areport-stage-\d\z/
  end

  test 'should get admin progress' do
    get :admin_progress
    assert_select 'h1', 'Admin progress'
  end

end
