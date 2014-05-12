require 'test_helper'

class ScriptLevelsControllerTest < ActionController::TestCase
  include Devise::TestHelpers

  include LevelsHelper # test the levels helper stuff here because it has to do w/ routes...

  setup do
    @script = create(:script)
    @level = create(:level, :blockly)
    @first_script_level = create(:script_level, :script => @script, :chapter => 1)
    create(:script_level, :script => @script, :chapter => 5)
    @script_level = create(:script_level, :script => @script, :level => @level, :chapter => 10)
    @admin = create(:admin)
    sign_in(@admin)
  end
  
  test "should show script level" do
    @controller.expects :slog

    get :show, script_id: @script, id: @script_level.id
    assert_response :success

    assert_equal @script_level, assigns(:script_level)
  end

  test "special routing for scripts" do
    assert_routing({method: "get", path: '/hoc/reset'},
                   {controller: "script_levels", action: "show", script_id: Script::HOC_ID, reset: true})
    assert_generates('/hoc/reset',
                     {controller: "script_levels", action: "show", script_id: Script::HOC_ID.to_s, reset: true})

    assert_routing({method: "get", path: '/hoc/1'},
                   {controller: "script_levels", action: "show", script_id: Script::HOC_ID, chapter: "1"})
    assert_generates('/hoc/1',
                   {controller: "script_levels", action: "show", script_id: Script::HOC_ID.to_s, chapter: "1"})
    assert_equal '/hoc/1', build_script_level_path(ScriptLevel.find_by(script_id: Script::HOC_ID, chapter: 1))
    

    assert_routing({method: "get", path: '/builder/5'},
                   {controller: "script_levels", action: "show", script_id: Script::BUILDER_ID, chapter: "5"})
    assert_generates('/builder/5',
                   {controller: "script_levels", action: "show", script_id: Script::BUILDER_ID, chapter: "5"})

    assert_routing({method: "get", path: '/k8intro/5'},
                   {controller: "script_levels", action: "show", script_id: Script::TWENTY_HOUR_ID, chapter: "5"})
    assert_generates('/k8intro/5',
                   {controller: "script_levels", action: "show", script_id: Script::TWENTY_HOUR_ID, chapter: "5"})

    assert_routing({method: "get", path: '/flappy/5'},
                   {controller: "script_levels", action: "show", script_id: Script::FLAPPY_ID, chapter: "5"})
    assert_generates('/flappy/5',
                   {controller: "script_levels", action: "show", script_id: Script::FLAPPY_ID, chapter: "5"})

    assert_routing({method: "get", path: '/jigsaw/5'},
                   {controller: "script_levels", action: "show", script_id: Script::JIGSAW_ID, chapter: "5"})
    assert_generates('/jigsaw/5',
                   {controller: "script_levels", action: "show", script_id: Script::JIGSAW_ID, chapter: "5"})


    # 'normal' script level routing
    assert_routing({method: "get", path: '/s/1/level/3'},
                   {controller: "script_levels", action: "show", script_id: Script::TWENTY_HOUR_ID.to_s, id: "3"})
    assert_equal '/s/1/level/3', build_script_level_path(ScriptLevel.find(3))
  end

  test "routing for special scripts without stage" do
    script = Script.find Script::FLAPPY_ID
    sl1 = script.script_levels.first
    sl2 = script.script_levels.last

    assert_routing({method: "get", path: "/s/flappy/level/#{sl1.id}"},
                   {controller: "script_levels", action: "show", script_id: 'flappy', id: sl1.id.to_s})
    assert_equal "/s/flappy/level/#{sl1.id}", build_script_level_path(sl1)

    assert_routing({method: "get", path: "/s/flappy/level/#{sl2.id}"},
                   {controller: "script_levels", action: "show", script_id: 'flappy', id: sl2.id.to_s})
    assert_equal "/s/flappy/level/#{sl2.id}", build_script_level_path(sl2)

  end

  test "routing for custom scripts with stage" do
    script = create(:script, :name => 'laurel')
    stage_1 = create(:stage, script: script, position: 1)
    stage_2 = create(:stage, script: script, position: 2)
    s1_l1 = create(:script_level, script: script, stage: stage_1, :position => 1)
    s2_l1 = create(:script_level, script: script, stage: stage_2, :position => 1)
    s2_l2 = create(:script_level, script: script, stage: stage_2, :position => 2)

    assert_routing({method: "get", path: "/s/laurel/stage/1/puzzle/1"},
                   {controller: "script_levels", action: "show", script_id: 'laurel', stage_id: stage_1.position.to_s, id: "1"})
    assert_equal "/s/laurel/stage/1/puzzle/1", build_script_level_path(s1_l1)
  end

  test "redirecting to canonical url for custom scripts" do

  end

  test "redirecting to canonical url for special scripts" do

  end

  test "redirecting to canonical url for 20 hour" do

  end

  test "redirecting to canonical url for hoc" do

  end
  
  test "should show script level by chapter" do
    @controller.expects :slog

    # this works for 'special' scripts like flappy, hoc
    expected_script_level = ScriptLevel.where(script_id: Script::FLAPPY_ID, chapter: 5).first

    get :show, script_id: Script::FLAPPY_ID, chapter: '5'
    assert_response :success

    assert_equal expected_script_level, assigns(:script_level)
  end

  test "show with the reset param should reset session when not logged in" do
    sign_out(@admin)
    session[:progress] = {5 => 10}

    get :show, script_id: Script::HOC_ID, reset: true

    assert_redirected_to hoc_chapter_path(chapter: 1)

    assert !session[:progress]
    assert !session['warden.user.user.key']
  end

  test "show with the reset param should not reset session when logged in" do
    sign_in(create(:user))
    get :show, script_id: Script::HOC_ID, reset: true

    assert_redirected_to hoc_chapter_path(chapter: 1)

    # still logged in
    assert session['warden.user.user.key'].first.first
  end
  
  test "should select only callouts for current script level" do
    @controller.expects :slog

    callout1 = create(:callout, script_level: @script_level)
    callout2 = create(:callout, script_level: @script_level)
    irrelevant_callout = create(:callout)
    get :show, script_id: @script.id, id: @script_level.id
    assert(assigns(:callouts_to_show).include?(callout1))
    assert(assigns(:callouts_to_show).include?(callout2))
    assert(!assigns(:callouts_to_show).include?(irrelevant_callout))
  end

  test "should localize callouts" do
    @controller.expects :slog

    create(:callout, script_level: @script_level, localization_key: 'run')
    get :show, script_id: @script.id, id: @script_level.id
    assert_not_nil(assigns(:callouts).find{|c| c['localized_text'] == 'Hit "Run" to try your program'})
  end
  
  test "should render blockly partial for blockly levels" do
    @controller.expects :slog

    script = create(:script)
    level = create(:level, :blockly)
    script_level = create(:script_level, :script => script, :level => level)
    get :show, script_id: script.id, id: script_level.id
    assert_template partial: '_blockly'
  end
  
  test "with callout defined should define callout JS" do
    @controller.expects :slog

    create(:callout, script_level: @script_level)
    get :show, script_id: @script.id, id: @script_level.id
    assert(@response.body.include?('Drag a \"move\" block and snap it below the other block'))
  end

  test "should carry over previous blocks" do
    blocks = "<hey>"
    level = Level.where(level_num: "3_8").first
    script_level = ScriptLevel.where(level_id: level.id).first
    level_source = LevelSource.lookup(level, blocks)
    Activity.create!(user: @admin, level: level, lines: "1", attempt: "1", test_result: "100", time: "1000", level_source: level_source)
    next_script_level = ScriptLevel.where(level: Level.where(level_num: "3_9").first).first
    get :show, script_id: script_level.script.id, id: next_script_level.id
    assert_equal blocks, assigns["start_blocks"]
  end
end
