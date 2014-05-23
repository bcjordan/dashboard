class Karel < Maze

  # List of possible skins, the first is used as a default.
  def self.skins
    ['farmer', 'farmer_night', 'bee']
  end

  # If type is "Karel" return a 3 entry hash with keys 'maze', 'initial_dirt',
  # and 'final_dirt', the keys map to 2d arrays blockly can render.
  # final_dirt is always zeroed out until it is removed from Blockly.
  def self.parse_maze(maze_json, size)
    maze = JSON.parse(maze_json)
    map, initial_dirt, final_dirt = (0...3).map { Array.new(size) { Array.new(size, 0) }}
    maze.each_with_index do |row, x|
      row.each_with_index do |cell, y|
        # "+X" or "-X" cells define dirt
        if cell[0] == '+' || cell[0] == '-'
          map[x][y] = 1 # map is a path
          initial_dirt[x][y] = Integer(cell, 10)
        else
          map[x][y] = cell
        end
      end
    end

    { 'maze' => map, 'initial_dirt' => initial_dirt, 'final_dirt' => final_dirt }
  end

  def self.unparse_maze(contents)
    maze, initial_dirt, final_dirt = [contents['maze'], contents['initial_dirt'], contents['final_dirt']]
    output = Array.new(maze.size) { Array.new(maze[0].size, 0) }
    maze.each_with_index do |row, x|
      row.each_with_index do |map, y|
        dirt = initial_dirt[x][y]
        if map == 1 && dirt != 0
          output[x][y] = (dirt > 0 ? '+' : '') + dirt.to_s
        else
          output[x][y] = map
        end
      end
    end
    output
  end

  def toolbox(type)
    common_blocks(type) + '<block type="maze_dig"></block>
    <block type="maze_fill"></block>
    <block type="maze_forever"></block>
    <block type="maze_nectar"></block>
    <block type="maze_honey"></block>
    <block type="karel_if"></block>
    <block type="maze_untilBlocked"></block>
    <block type="maze_untilBlockedOrNotClear"></block>
    <block type="math_number">
      <title name="NUM">1</title>
    </block>'
  end
end
