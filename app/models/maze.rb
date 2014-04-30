require "csv"

class Maze < Level
  # Fix STI routing http://stackoverflow.com/a/9463495
  def self.model_name
    Level.model_name
  end

  def self.create_from_level_builder(params, level_params)
    contents = CSV.new(params[:maze_source].read)
    game = Game.custom_maze
    size = params[:size].to_i

    maze = Level.parse_maze(contents, params[:type], size)

    skin = params[:type] == 'maze' ? 'birds' : 'farmer'
    level = create(level_params.merge(game: game, level_num: 'custom', skin: skin))
    level.properties.update(maze)
    level.save!
    level
  end

  def complete_toolbox
    '<xml id="toolbox" style="display: none;">
      <block type="maze_moveForward"></block>
      <block type="maze_turn">
        <title name="DIR">turnLeft</title>
      </block>
      <block type="maze_turn">
        <title name="DIR">turnRight</title>
      </block>
      <block type="maze_forever"></block>
      <block type="maze_if">
        <title name="DIR">isPathLeft</title>
      </block>
      <block type="maze_if"></block>
      <block type="maze_ifElse"></block>
      <block type="controls_repeat">
        <title name="TIMES">5</title>
      </block>
      <block type="maze_forever"></block>
      <block type="maze_if">
        <title name="DIR">isPathLeft</title>
      </block>
      <block type="maze_if">
        <title name="DIR">isPathRight</title>
      </block>
      <block type="maze_ifElse"></block>
    </xml>'
  end
end
