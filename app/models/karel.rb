class Karel < Maze
  serialized_attrs :nectar_goal, :honey_goal

  # List of possible skins, the first is used as a default.
  def self.skins
    ['farmer', 'farmer_night', 'bee']
  end

  # List of possible flower types
  def self.flower_types
    ['redWithNectar', 'redNectarHidden', 'purpleNectarHidden', 'hiddenFlower']
  end

  # If type is "Karel" return a 3 entry hash with keys 'maze', 'initial_dirt',
  # and 'final_dirt', the keys map to 2d arrays blockly can render.
  # final_dirt is always zeroed out until it is removed from Blockly.
  def self.parse_maze(maze_json, size)
    maze_json = maze_json.to_json if maze_json.is_a? Array
    maze = JSON.parse(maze_json)
    map, initial_dirt, final_dirt = (0...3).map { Array.new(maze.length) { Array.new(maze[0].length, 0) }}
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

    { 'maze' => map.to_json, 'initial_dirt' => initial_dirt.to_json, 'final_dirt' => final_dirt.to_json }
  end

  def self.unparse_maze(contents)
    maze, initial_dirt, final_dirt = %w(maze initial_dirt final_dirt).map do |x|
      data = contents[x]
      data = JSON.parse(data) if data.is_a?(String)
      data
    end
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
    </block>
    <block type="bee_ifNectarAmount"></block>
    <block type="bee_ifTotalNectar"></block>
    <block type="bee_ifFlower"></block>
    <block type="bee_whileNectarAmount"></block>'
  end
end
