class Karel < Maze
  # List of possible skins, the first is used as a default.
  def self.skins
    ['farmer', 'farmer_night']
  end

  # Karel level builder mazes have the information for three 2D arrays embeded
  #   into one.
  # final_dirt is always zeroed out until it is removed from Blockly.
  def self.parse_maze(contents, size)
    maze = super['maze']

    map, initial_dirt, final_dirt = (0...3).map { Array.new(size) { Array.new(size, 0) }}

    maze.each_with_index do |row, x|
      row.each_with_index do |cell, y|
        (cell >= 100 ? map : initial_dirt)[x][y] = cell % 100
      end
    end

    { 'maze' => map, 'initial_dirt' => initial_dirt, 'final_dirt' => final_dirt }
  end

  def toolbox
    common_blocks + '<block type="maze_dig"></block>
    <block type="maze_fill"></block>
    <block type="maze_forever"></block>
    <block type="karel_if"></block>
    <block type="maze_untilBlocked"></block>
    <block type="maze_untilBlockedOrNotClear"></block>
    <block type="math_number">
      <title name="NUM">1</title>
    </block>'
  end
end
