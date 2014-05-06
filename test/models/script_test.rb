require 'test_helper'

class ScriptTest < ActiveSupport::TestCase
  def setup
    @game = create(:game)
    @script_file = File.join(self.class.fixture_path, "test.script")
    # Level names match those in 'test.script'
    @levels = (1..5).map { |n| create(:level, :name => "Level #{n}") }
  end

  test 'create script from DSL' do
    x = Script.setup([], [@script_file])
    assert_equal 'Level 1', x[0][0].level.name
    assert_equal 'Stage2', x[0][3].stage.name
  end

  test 'should not change Script[Level] ID when reseeding' do
    x = Script.setup([], [@script_file])
    script_id = x[0][4].script_id
    script_level_id = x[0][4].id

    x = Script.setup([], [@script_file])
    assert_equal script_id, x[0][4].script_id
    assert_equal script_level_id, x[0][4].id
  end

  test 'should not change Script ID when changing script levels and options' do
    x = Script.setup([], [@script_file])
    script_id = x[0][4].script_id
    script_level_id = x[0][4].id

    parsed_csv = Script.parse_csv(`config/generate_scripts #{@script_file}`, "\t", Script::SCRIPT_MAP)

    # Set different level name in tested script
    parsed_csv[4]['name'] = "Level 1"

    # Set different 'trophies' and 'hidden' options from defaults in Script.setup
    options = {name: File.basename(@script_file, ".script"), trophies: true, hidden: false}
    x = Script.add_script(options, parsed_csv, true)
    assert_equal script_id, x[4].script_id
    assert_not_equal script_level_id, x[4].id
  end
end
