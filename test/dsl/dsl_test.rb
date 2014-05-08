require 'test_helper'

class DslTest < ActiveSupport::TestCase

  test 'test Script DSL' do
    input_dsl = "
stage 'Stage1'
level 'Level 1'
level 'Level 2'
level 'Level 3'

stage 'Stage2'
level 'Level 4'
level 'Level 5'
"
    output, i18n = ScriptDSL.parse(input_dsl, 'test')
    expected = [
      {:stage => 'Stage1', :levels =>
        [{:name => 'Level 1'}, {:name => 'Level 2'}, {:name => 'Level 3'}]},
      {:stage => 'Stage2', :levels =>
        [{:name => 'Level 4'}, {:name => 'Level 5'}]}]
    i18n_expected = {'en'=>{'data'=>{'script'=>{'name'=>{'test'=>{
        'Stage1'=>'Stage1',
        'Stage2'=>'Stage2',
        'desc'=>'Custom script test'
    }}}}}}
    assert_equal expected, output
    assert_equal i18n_expected, i18n
  end
end