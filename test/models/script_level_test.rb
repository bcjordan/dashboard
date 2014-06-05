require 'test_helper'

class ScriptLevelTest < ActiveSupport::TestCase
  def setup
    @script_level = create(:script_level)
    @script_level2 = create(:script_level)
    @stage = create(:stage)
    @stage2 = create(:stage)
  end

  test "setup should work" do
    assert_not_nil @script_level.script
    assert_not_nil @script_level.level
  end

  test "should get position when assigned to stage" do
    @script_level.update(stage: @stage)
    @script_level.move_to_bottom
    assert_equal 1, @script_level.position
  end

  test "should return position when assigned to stage" do
    @script_level.update(stage: @stage)
    @script_level.move_to_bottom
    @script_level.update(game_chapter: 2)
    assert_equal 1, @script_level.stage_or_game_position
  end

  test "should return chapter when no stage" do
    @script_level.update(game_chapter: 1)
    @script_level.update(position: 2)
    assert_equal 1, @script_level.stage_or_game_position
  end

  test "should destroy when related level is destroyed" do
    @script_level = create(:script_level)
    @script_level.level.destroy
    assert_not ScriptLevel.exists?(@script_level)
  end

  test "destroying should not destroy related level" do
    @script_level = create(:script_level)
    level = @script_level.level
    @script_level.destroy

    assert Level.exists?(level)
  end

  test 'counts puzzle position and total in stage' do
    # default script
    sl = Script.twenty_hour_script.script_levels[1]
    assert_equal 1, sl.stage_or_game_position
    assert_equal 20, sl.stage_or_game_total

    # custom script
    sl = @script_level
    sl.update(stage: @stage)
    sl.move_to_bottom
    @script_level2.update(stage: @stage)
    @script_level2.move_to_bottom
    assert_equal 1, sl.stage_or_game_position
    assert_equal 2, sl.stage_or_game_total
  end

end
