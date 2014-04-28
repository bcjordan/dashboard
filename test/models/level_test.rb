require 'test_helper'
include ActionDispatch::TestProcess

class LevelTest < ActiveSupport::TestCase
  setup do
    @turtle_data = {:game_id=>23, :name=>"__bob4", :level_num=>"custom", :skin=>"artist", :instructions=>"sdfdfs"}
    @custom_turtle_data = @turtle_data.merge(:solution_level_source_id=>4, :user_id=>1, :program=>"<hey>")
    @maze_data = {:game_id=>25, :name=>"__bob4", :level_num=>"custom", :skin=>"birds", :instructions=>"sdfdfs"}
    @custom_maze_data = @maze_data.merge(:user_id=>1)

    @custom_level = Level.create(@custom_maze_data)
    @level = Level.create(@maze_data)
  end

  test "throws argument error on bad data" do
    maze = CSV.new(fixture_file_upload("maze_level_invalid.csv", "r"))
    assert_raises ArgumentError do
      Level.read_and_convert_maze_to_integer(maze, 8)
    end
  end

  test "reads and converts data" do
    csv = stub(:read => [['0', '1'], ['1', '2']])
    maze = Level.read_and_convert_maze_to_integer(csv, 2)
    assert_equal [[0, 1], [1, 2]], maze
  end

  test "parses maze data" do
    csv = stub(:read => [['0', '1'], ['1', '2']])
    maze = Level.parse_maze(csv, 'maze', 2)
    assert_equal({'maze' => [[0, 1], [1, 2]]}, maze)
  end

  test "parses karel data" do
    csv = stub(:read => [['100', '101'], ['102', '5']])
    maze = Level.parse_maze(csv, 'karel', 2)
    assert_equal({'maze' => [[0, 1], [2, 0]], 'initial_dirt' => [[0, 0], [0, 5]], 'final_dirt' => [[0, 0], [0, 0]]}, maze)
  end

  test "cannot create two custom levels with same name" do
    assert_no_difference('Level.count') do
      level2 = Level.create(@custom_maze_data)
      assert_not level2.valid?
      assert level2.errors.include?(:name)
    end
  end

  test "can create two custom levels with different names" do
    assert_difference('Level.count', 1) do
      @custom_maze_data[:name] = "__swoop"
      level2 = Level.create(@custom_maze_data)
      assert level2.valid?
    end
  end

  test "get custom levels" do
    assert Level.custom_levels.include?(@custom_level)
    assert_not Level.custom_levels.include?(@level)
  end

  test "create turtle level of correct subclass" do
    level = Turtle.create(@turtle_data)
    assert_equal "Turtle", level.type
  end

  test "create maze level of correct subclass" do
    level = Maze.create(@maze_data)
    assert_equal "Maze", level.type
  end

  test "create turtle level from level builder" do
    level = Turtle.create_from_level_builder(@custom_turtle_data)

    assert_equal "Turtle", level.type
    assert_equal level.instructions, @custom_turtle_data[:instructions]
  end
end
