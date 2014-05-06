require 'test_helper'

class LevelsHelperTest < ActionView::TestCase
  include LocaleHelper

  setup do
    @maze_data = {:game_id=>25, :user_id => 1, :name=>"__bob4", :level_num=>"custom", :skin=>"birds", :instructions=>"sdfdfs"}
    @level = Maze.create(@maze_data)
  end

  test "should parse maze level with non string array" do
    @level.properties["maze"] = [[0, 0], [2, 3]]
    level, options = blockly_options
    assert (level["map"].is_a? Array), "Maze is not an array"

    @level.properties["maze"] = @level.properties["maze"].to_s
    level, options = blockly_options
    assert (level["map"].is_a? Array), "Maze is not an array"
  end

  test "change default level localization after locale switch" do
    DEFAULT_LOCALE = 'en-us'
    NEW_LOCALE = 'de-de'
    @level.instructions = nil
    @level.level_num = '2_2'
    I18n.locale = DEFAULT_LOCALE
    level, options = blockly_options
    assert_equal I18n.t('data.level.instructions.maze_2_2', locale: DEFAULT_LOCALE), level['instructions']

    I18n.locale = NEW_LOCALE
    level, options = blockly_options
    assert_equal I18n.t('data.level.instructions.maze_2_2', locale: NEW_LOCALE), level['instructions']
    I18n.locale = DEFAULT_LOCALE
  end

  test "display custom level instructions instead of localized string" do
    @level.instructions = 'custom instructions'
    @level.level_num = '2_2'
    level, options = blockly_options
    assert_equal 'custom instructions', level['instructions']
  end
end
