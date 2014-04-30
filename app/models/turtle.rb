class Turtle < Level
  # Fix STI routing http://stackoverflow.com/a/9463495
  def self.model_name
    Level.model_name
  end

  def self.create_from_level_builder(params)
    game = Game.find(params[:game_id])
    level = create(instructions: params[:instructions], name: params[:name], x: params[:x], y: params[:y], start_direction: params[:start_direction], game: game, level_num: 'custom', skin: 'artist')
    solution = LevelSource.lookup(level, params[:program])
    level.update(solution_level_source: solution)
    level
  end

  def complete_toolbox
    '<xml id="toolbox" style="display: none;">
      <category id="actions" name="Actions">
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
      <category name="Variables" custom="VARIABLE"></category>
    </xml>'
  end
end
