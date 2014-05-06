class Artist < Level
  # Fix STI routing http://stackoverflow.com/a/9463495
  def self.model_name
    Level.model_name
  end

  # List of possible skins, the first is used as a default.
  def self.skins
    ['artist', 'artist_zombie']
  end

  def self.create_from_level_builder(params, level_params)
    game = Game.find(params[:game_id])
    level = create(level_params.merge(user: params[:user], x: params[:x], y: params[:y], start_direction: params[:start_direction], game: game, level_num: 'custom'))
    solution = LevelSource.lookup(level, params[:program])
    level.update(solution_level_source: solution)
    level
  end

  def toolbox
    k1_blocks_category + '<category id="actions" name="Actions">
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
    <category name="Variables" custom="VARIABLE"></category>'
  end

  def k1_blocks_category
    '<category name="K1 Simplified">
      <block type="controls_repeat_simplified">
        <title name="TIMES">5</title>
      </block>
      <block type="simple_move_up"></block>
      <block type="simple_move_down"></block>
      <block type="simple_move_left"></block>
      <block type="simple_move_right"></block>
      <block type="simple_move_up_length"></block>
      <block type="simple_move_down_length"></block>
      <block type="simple_move_left_length"></block>
      <block type="simple_move_right_length"></block>
      <block type="simple_jump_up"></block>
      <block type="simple_jump_down"></block>
      <block type="simple_jump_left"></block>
      <block type="simple_jump_right"></block>
    </category>'
  end
end
