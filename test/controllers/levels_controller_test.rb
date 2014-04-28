require 'test_helper'

class LevelsControllerTest < ActionController::TestCase
  include Devise::TestHelpers

  setup do
    @level = create(:level)
    @user = create(:admin)
    sign_in(@user)
    @program = "<hey>"

    @not_admin = create(:user)
    Rails.env = "staging"
  end

  teardown do
    Rails.env = "test"
  end

  test "should get index" do
    get :index, game_id: @level.game
    assert_response :success
    assert_not_nil assigns(:levels)
  end

  test "should get new" do
    get :new, game_id: @level.game
    assert_response :success
  end

  test "should get new karel" do
    get :new, type: 'karel'

    css = css_select "#level_type"
    assert_equal "karel", css.first.attributes['value']
    assert_response :success
  end

# this test is not working because Level::BUILDER is nil in tests
#  test "should get builder" do
#    get :builder, game_id: @level.game
#
#    assert_response :success
#  end

  test "should not get builder if not admin" do
    sign_in @not_admin
    get :new, game_id: @level.game
    assert_response :forbidden
  end

  test "should create maze level" do
    maze = fixture_file_upload("maze_level.csv", "r")
    game = Game.find_by_name("CustomMaze")

    assert_difference('Level.count') do
      post :create, :level => {:name => "NewCustomLevel", :instructions => "Some Instructions"}, :game_id => game.id, :program => @program, :level_type => 'maze', :maze_source => maze, :size => 8
    end

    assert assigns(:level)
    assert assigns(:level).game

    assert_redirected_to game_level_path(assigns(:level).game, assigns(:level))
  end

  test "should not create invalid maze level" do
    maze = fixture_file_upload("maze_level_invalid.csv", "r")
    game = Game.find_by_name("CustomMaze")

    assert_no_difference('Level.count') do
      post :create, :level => {:name => "NewCustomLevel", :instructions => "Some Instructions"}, :game_id => game.id, :program => @program, :level_type => 'maze', :maze_source => maze, :size => 8
    end

    assert_response :not_acceptable
  end

  test "should create karel level" do
    karel = fixture_file_upload("karel_level.csv", "r")
    game = Game.find_by_name("CustomMaze")

    assert_difference('Level.count') do
      post :create, :level => {:name => "NewCustomLevel", :instructions => "Some Instructions"}, :game_id => game.id, :program => @program, :level_type => 'karel', :maze_source => karel, :size => 8
    end

    assert assigns(:level)
    assert assigns(:level).game

    assert_redirected_to game_level_path(assigns(:level).game, assigns(:level))
  end

  test "should not create invalid karel level" do
    karel = fixture_file_upload("karel_level_invalid.csv", "r")
    game = Game.find_by_name("CustomMaze")

    assert_no_difference('Level.count') do
      post :create, :level => {:name => "NewCustomLevel", :instructions => "Some Instructions"}, :game_id => game.id, :program => @program, :level_type => 'karel', :maze_source => karel, :size => 8
    end

    assert_response :not_acceptable
  end

  test "should create artist level" do
    game = Game.find_by_name("Custom")
    assert_difference('Level.count') do
      post :create, :game_id => game.id, :name => "NewCustomLevel", :program => @program, :level_type => 'artist'
    end

    assert_equal game_level_url(assigns(:level).game, assigns(:level)), JSON.parse(@response.body)["redirect"]
  end

  test "should update blocks" do
    post :update_blocks, :level_id => @level.id, :game_id => @level.game.id, :type => 'toolbox_blocks', :program => @program
    level = assigns(:level)
    assert_equal level.properties[:toolbox_blocks.to_s], @program
  end

  test "should not update blocks if not admin" do
    sign_in @not_admin
    post :update_blocks, :level_id => @level.id, :game_id => @level.game.id, :type => 'toolbox_blocks', :program => @program
    assert_response :forbidden
  end

  test "should set coordinates and direction from query string" do
    get :new, :type => "artist", :x => 5, :y => 10, :start_direction => 90
    level = assigns(:level)
    assert_equal 5, level.x
    assert_equal 10, level.y
    assert_equal 90, level.start_direction
  end

  test "should handle coordinates if non integer" do
    get :new, :type => "artist", :x => "", :y => 5.5, :start_direction => "hi"
    level = assigns(:level)
    assert_nil level.x
    assert_nil level.y
    assert_nil level.start_direction
  end

  test "should not create level if not admin" do
    sign_in @not_admin
    assert_no_difference('Level.count') do
      post :create, :name => "NewCustomLevel", :program => @program, game_id: 1
    end

    assert_response :forbidden
  end

  # This should represent the behavior on production.
  test "should not modify level if on test env" do
    Rails.env = "test"
    post :create, :name => "NewCustomLevel", :program => @program, game_id: 1
    assert_response :forbidden
  end

  test "should show level" do
    get :show, id: @level, game_id: @level.game
    assert_response :success
  end

  test "should show level on test env" do
    Rails.env = "test"
    get :show, id: @level, game_id: @level.game
    assert_response :success
  end

  test "should get edit" do
    get :edit, id: @level, game_id: @level.game
    assert_response :success
  end

  test "should get edit blocks" do
    @level.update(toolbox_blocks: @program)
    get :edit_blocks, level_id: @level.id, game_id: @level.game, type: 'toolbox_blocks'
    assert_equal @program, assigns[:start_blocks]
  end

  test "should update level" do
    patch :update, id: @level, game_id: @level.game, level: {  }
    level = assigns(:level)
    assert_redirected_to game_level_path(level.game, level)
  end

  test "should destroy level" do
    assert_difference('Level.count', -1) do
      delete :destroy, id: @level, game_id: @level.game
    end

    assert_redirected_to game_levels_path
  end

  test "should route new to levels" do
    assert_routing({method: "post", path: "/games/1/levels"}, {controller: "levels", action: "create", game_id: "1"})
  end

end
