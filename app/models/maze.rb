require "csv"

class Maze < Level
  # Fix STI routing http://stackoverflow.com/a/9463495
  def self.model_name
    Level.model_name
  end

  # List of possible skins, the first is used as a default.
  def self.skins
    ['birds', 'pvz']
  end

  def self.create_from_level_builder(params, level_params)
    contents = CSV.new(params[:maze_source].read)
    game = Game.custom_maze
    size = params[:size].to_i

    maze = parse_maze(contents, size)
    level = create(level_params.merge(user: params[:user], game: game, level_num: 'custom'))
    level.properties.update(maze)
    level.save!
    level
  end

  # contents - should respond to read by returning a 2d square array
  #   with the given size, representing a blockly level.
  # Throws ArgumentError if there is a non integer value in the array.
  def self.read_and_convert_maze_to_integer(contents, size)
    raw_maze = contents.read[0...size]
    raw_maze.map {|row| row.map {|cell| Integer(cell)}}
  end

  # Parses the 2d array contents.
  # If type is "maze" return a single entry hash with 'maze' mapping to a 2d
  #   array that Blockly can render.
  # If type is "karel" return a 3 entry hash with keys 'maze', 'initial_dirt',
  #   and 'final_dirt', the keys map to 2d arrays blockly can render.
  # Throws ArgumentError if there is a non integer value in the array.
  def self.parse_maze(contents, size)
    { 'maze' => read_and_convert_maze_to_integer(contents, size) }
  end

  def common_blocks
    k1_blocks + '<block type="maze_moveForward"></block>
    <block type="maze_turn">
      <title name="DIR">turnLeft</title>
    </block>
    <block type="maze_turn">
      <title name="DIR">turnRight</title>
    </block>
    <block type="controls_repeat">
      <title name="TIMES">5</title>
    </block>'
  end

  def k1_blocks
    '<block type="controls_repeat_simplified">
      <title name="TIMES">5</title>
    </block>
    <block type="maze_moveNorth"></block>
    <block type="maze_moveSouth"></block>
    <block type="maze_moveEast"></block>
    <block type="maze_moveWest"></block>'
  end

  def toolbox
      common_blocks + '<block type="maze_forever"></block>
      <block type="maze_if">
        <title name="DIR">isPathLeft</title>
      </block>
      <block type="maze_if"></block>
      <block type="maze_ifElse"></block>
      <block type="maze_forever"></block>
      <block type="maze_if">
        <title name="DIR">isPathLeft</title>
      </block>
      <block type="maze_if">
        <title name="DIR">isPathRight</title>
      </block>
      <block type="maze_ifElse"></block>'
  end
end
