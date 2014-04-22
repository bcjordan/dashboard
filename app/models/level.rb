# An individual Blockly level definition
class Level < ActiveRecord::Base
  serialize :properties, JSON
  belongs_to :game
  has_and_belongs_to_many :concepts
  belongs_to :solution_level_source, :class_name => "LevelSource"
  belongs_to :user
  validates_length_of :name, within: 1..70
  validates_uniqueness_of :name, conditions: -> { where.not(user_id: nil) }
  after_save :write_custom_levels_to_file if Rails.env.in?(["staging", "development"])
  after_initialize :init

  def init
    self.properties  ||= {}
  end

  def self.builder
    @@level_builder ||= find_by_name('builder')
  end

  def videos
    ([game.intro_video] + concepts.map(&:video)).reject(&:nil?)
  end

  def complete_toolbox
    case self.game.app
    when 'turtle'
      '<xml id="toolbox" style="display: none;">
        <category id="actions" name="Actions">
          <block type="simple_move_up"></block>
          <block type="simple_move_down"></block>
          <block type="simple_move_left"></block>
          <block type="simple_move_right"></block>
          <block type="simple_jump_up"></block>
          <block type="simple_jump_down"></block>
          <block type="simple_jump_left"></block>
          <block type="simple_jump_right"></block>
          <block type="simple_move_up_length"></block>
          <block type="simple_move_down_length"></block>
          <block type="simple_move_left_length"></block>
          <block type="simple_move_right_length"></block>
          <block type="simple_jump_up_length"></block>
          <block type="simple_jump_down_length"></block>
          <block type="simple_jump_left_length"></block>
          <block type="simple_jump_right_length"></block>
          <block type="simple_move_length_short"></block>
          <block type="simple_move_length_long"></block>
          <block type="draw_move">
            <value name="VALUE">
              <block type="math_number">
                <title name="NUM">100</title>
              </block>
            </value>
          </block>
          <block type="draw_turn">
            <value name="VALUE">
              <block type="math_number">
                <title name="NUM">90</title>
              </block>
            </value>
          </block>
          <block id="draw-width" type="draw_width">
            <value name="WIDTH">
              <block type="math_number">
                <title name="NUM">1</title>
              </block>
            </value>
          </block>
        </category>
        <category name="Color">
          <block id="draw-color" type="draw_colour">
            <value name="COLOUR">
              <block type="colour_picker"></block>
            </value>
          </block>
          <block id="draw-color" type="draw_colour">
            <value name="COLOUR">
              <block type="colour_random"></block>
            </value>
          </block>
        </category>
        <category name="Functions" custom="PROCEDURE"></category>
        <category name="Loops">
          <block type="controls_repeat_simplified"></block>
          <block type="controls_for_counter">
            <value name="FROM">
              <block type="math_number">
                <title name="NUM">1</title>
              </block>
            </value>
            <value name="TO">
              <block type="math_number">
                <title name="NUM">100</title>
              </block>
            </value>
            <value name="BY">
              <block type="math_number">
                <title name="NUM">10</title>
              </block>
            </value>
          </block>
          <block type="controls_repeat">
            <title name="TIMES">4</title>
          </block>
        </category>
        <category name="Math">
          <block type="math_number"></block>
          <block type="math_arithmetic" inline="true"></block>
          <block type="math_random_int">
            <value name="FROM">
              <block type="math_number">
                <title name="NUM">1</title>
              </block>
            </value>
            <value name="TO">
              <block type="math_number">
                <title name="NUM">100</title>
              </block>
            </value>
          </block>
          <block type="math_random_float"></block>
        </category>
        <category name="Variables" custom="VARIABLE"></category>
      </xml>'
    when 'maze'
      '<xml id="toolbox" style="display: none;">
        <block type="maze_moveNorth"></block>
        <block type="maze_moveSouth"></block>
        <block type="maze_moveEast"></block>
        <block type="maze_moveWest"></block>
        <block type="controls_repeat_simplified"></block>
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
    else
      '<xml></xml>'
    end
  end

  def self.custom_levels
    where("user_id IS NOT NULL")
  end

  def write_custom_levels_to_file
    File.open(Rails.root.join("config", "scripts", "custom_levels.json"), 'w+') do |file|
      file << Level.custom_levels.to_json
    end
  end
end
