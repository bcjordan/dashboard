require 'test_helper'

class ScriptTest < ActiveSupport::TestCase
  def setup
    @game = create(:game)
    @script_file = File.join(self.class.fixture_path, "test.script")
    # Level names match those in 'test.script'
    @levels = (1..5).map { |n| create(:level, :name => "Level #{n}") }
  end

  test 'create script from DSL' do
    scripts, _ = Script.setup([], [@script_file])
    script = scripts[0]
    assert_equal 'Level 1', script.levels[0].name
    assert_equal 'Stage2', script.script_levels[3].stage.name
  end

  test 'should not change Script[Level] ID when reseeding' do
    scripts, _ = Script.setup([], [@script_file])
    script = scripts[0]
    script_id = script.script_levels[4].script_id
    script_level_id = script.script_levels[4].id

    scripts,_ = Script.setup([], [@script_file])
    assert_equal script_id, scripts[0].script_levels[4].script_id
    assert_equal script_level_id, scripts[0].script_levels[4].id
  end

  test 'should not change Script ID when changing script levels and options' do
    scripts,_ = Script.setup([], [@script_file])
    script_id = scripts[0].script_levels[4].script_id
    script_level_id = scripts[0].script_levels[4].id

    parsed_script = ScriptDSL.parse_file(@script_file)[0].map{|stage| stage[:levels]}.flatten

    # Set different level name in tested script
    parsed_script[4]['name'] = "Level 1"

    # Set different 'trophies' and 'hidden' options from defaults in Script.setup
    options = {name: File.basename(@script_file, ".script"), trophies: true, hidden: false}
    script = Script.add_script(options, parsed_script, true)
    assert_equal script_id, script.script_levels[4].script_id
    assert_not_equal script_level_id, script.script_levels[4].id
  end

  test 'should not create two scripts with same name' do
    create(:script, :name => 'script')
    raise = assert_raises ActiveRecord::RecordInvalid do
      create(:script, :name => 'Script')
    end
    assert_equal 'Validation failed: Name has already been taken', raise.message
  end
end
