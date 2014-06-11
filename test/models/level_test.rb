require 'test_helper'
include ActionDispatch::TestProcess

class LevelTest < ActiveSupport::TestCase
  setup do
    @turtle_data = {:game_id=>23, :name=>"__bob4", :level_num=>"custom", :skin=>"artist", :instructions=>"sdfdfs"}
    @custom_turtle_data = {:solution_level_source_id=>4, :user_id=>1}
    @maze_data = {:game_id=>25, :name=>"__bob4", :level_num=>"custom", :skin=>"birds", :instructions=>"sdfdfs"}
    @custom_maze_data = @maze_data.merge(:user_id=>1)
    @custom_level = Blockly.create(@custom_maze_data)
    @level = Blockly.create(@maze_data)
  end

  test "throws argument error on bad data" do
    maze = CSV.new(fixture_file_upload("maze_level_invalid.csv", "r"))
    assert_raises ArgumentError do
      Maze.load_maze(maze, 8)
    end
  end

  test "reads and converts data" do
    csv = stub(:read => [['0', '1'], ['1', '2']])
    maze = Maze.load_maze(csv, 2)
    assert_equal [[0, 1], [1, 2]], maze
  end

  test "parses maze data" do
    csv = stub(:read => [['0', '1'], ['1', '2']])
    maze = Maze.parse_maze(Maze.load_maze(csv, 2).to_json, 2)
    assert_equal({'maze' => [[0, 1], [1, 2]].to_json}, maze)
  end

  test "parses karel data" do
    json = [[0,1,0],[2,'+5','-5'],[0,0,0]].to_json
    maze = Karel.parse_maze(json, 3)
    assert_equal({'maze' => [[0, 1, 0], [2, 1, 1], [0, 0, 0]].to_json, 'initial_dirt' => [[0, 0, 0], [0, 5, -5], [0, 0, 0]].to_json, 'final_dirt' => [[0, 0, 0], [0, 0, 0], [0, 0, 0]].to_json}, maze)
  end

  test "cannot create two custom levels with same name" do
    assert_no_difference('Level.count') do
      level2 = Level.create(@custom_maze_data)
      assert_not level2.valid?
      assert level2.errors.include?(:name)
    end
  end

  test "cannot create two custom levels with same name case insensitive" do
    assert_no_difference('Level.count') do
      name_upcase = @custom_maze_data[:name].upcase
      level2 = Level.create(@custom_maze_data.merge(name: name_upcase))
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
    level = Artist.create(@turtle_data)
    assert_equal "Artist", level.type
  end

  test "create maze level of correct subclass" do
    level = Maze.create(@maze_data)
    assert_equal "Maze", level.type
  end

  test "create turtle level from level builder" do
    program = "hey"
    level = Artist.create_from_level_builder(@turtle_data.merge!(program: program), {})

    assert_equal "Artist", level.type
    assert_equal program, level.properties[:solution_blocks]
  end

  test "basic toolbox check" do
    level = Maze.create(@maze_data)
    toolbox = Nokogiri::XML(level.complete_toolbox(:start_blocks))

    assert_equal "xml", toolbox.root().name
    assert_equal "toolbox", toolbox.root().attributes["id"].value

    first_block = toolbox.root().children.first

    assert_equal "block", first_block.name
    assert_equal "controls_repeat_simplified", first_block.attributes["type"].value
  end

  test "include type in json" do
    maze = Maze.create(@maze_data)
    maze_from_json = Level.create(JSON.parse(maze.to_json))
    assert maze_from_json.is_a? Maze
  end

  test 'serialize properties' do
    level = Blockly.new
    level.instructions = 'test!'
    assert_equal 'test!', level.properties['instructions']
    assert_equal level.instructions, level.properties['instructions']
  end

  test 'create with serialized properties' do
    level = Blockly.create(instructions: 'test')
    assert_equal 'test', level.instructions
    level.instructions = 'test2'
    assert_equal 'test2', level.instructions
  end

=begin
  test "level column migration" do
    level = Blockly.create(name: 'test-level-column-migration')
    level.send(:write_attribute, :instructions, 'test12333')
    puts "level1=#{level.as_json}"
    level.save!
    require File.join(Rails.root, 'db', 'migrate', '20140616231428_remove_level_data_columns')
    RemoveLevelDataColumns.migrate(:up)
    level.reload
    puts "level2=#{level.as_json}"
    RemoveLevelDataColumns.migrate(:down)
    level.reload
    puts "level3=#{level.as_json}"
  end
=end

end
