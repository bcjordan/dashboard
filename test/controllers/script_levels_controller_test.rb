require 'test_helper'

class ScriptLevelsControllerTest < ActionController::TestCase
  include Devise::TestHelpers

  include LevelsHelper # test the levels helper stuff here because it has to do w/ routes...

  setup do
    @admin = create(:admin)
    sign_in(@admin)

    @script = Script.find(Script::TWENTY_HOUR_ID)
    @script_level = @script.script_levels.fifth

    @custom_script = create(:script, :name => 'laurel')
    @custom_stage_1 = create(:stage, script: @custom_script, name: 'Laurel Stage 1', position: 1)
    @custom_stage_2 = create(:stage, script: @custom_script, name: 'Laurel Stage 2', position: 2)
    @custom_s1_l1 = create(:script_level, script: @custom_script,
                           stage: @custom_stage_1, :position => 1)
    @custom_s2_l1 = create(:script_level, script: @custom_script,
                           stage: @custom_stage_2, :position => 1)
    @custom_s2_l2 = create(:script_level, script: @custom_script,
                           stage: @custom_stage_2, :position => 2)
  end
  
  test "should show script level for twenty hour" do
    @controller.expects :slog

    get :show, script_id: Script::TWENTY_HOUR_ID, id: @script_level.id
    assert_response :success

    assert_equal @script_level, assigns(:script_level)
  end

  test "show redirects to canonical url for 20 hour" do
    sl = ScriptLevel.find_by script_id: Script::TWENTY_HOUR_ID, chapter: 3
    get :show, script_id: sl.script_id, chapter: sl.chapter

    assert_redirected_to "/s/1/level/#{sl.id}"
  end

  test "script level id based routing for 20 hour script" do
    # 'normal' script level routing
    sl = ScriptLevel.find 3
    assert_routing({method: "get", path: '/s/1/level/3'},
                   {controller: "script_levels", action: "show", script_id: Script::TWENTY_HOUR_ID.to_s, id: "3"})
    assert_equal '/s/1/level/3', build_script_level_path(sl)
  end

  test "chapter based routing" do
    assert_routing({method: "get", path: '/hoc/reset'},
                   {controller: "script_levels", action: "show", script_id: Script::HOC_ID, reset: true})

    hoc_level = ScriptLevel.find_by(script_id: Script::HOC_ID, chapter: 1)
    assert_routing({method: "get", path: '/hoc/1'},
                   {controller: "script_levels", action: "show", script_id: Script::HOC_ID, chapter: "1"})
    assert_equal '/hoc/1', build_script_level_path(hoc_level)

    builder_level = ScriptLevel.find_by(script_id: Script::BUILDER_ID, chapter: 1)
    assert_routing({method: "get", path: '/builder/1'},
                   {controller: "script_levels", action: "show", script_id: Script::BUILDER_ID, chapter: "1"})
    assert_equal '/builder/1', build_script_level_path(builder_level)

    # we don't actually use this
    assert_routing({method: "get", path: '/k8intro/5'},
                   {controller: "script_levels", action: "show", script_id: Script::TWENTY_HOUR_ID, chapter: "5"})

    flappy_level = ScriptLevel.find_by(script_id: Script::FLAPPY_ID, chapter: 5)
    assert_routing({method: "get", path: '/flappy/5'},
                   {controller: "script_levels", action: "show", script_id: Script::FLAPPY_ID, chapter: "5"})
    assert_equal "/flappy/5", build_script_level_path(flappy_level)

    jigsaw_level = ScriptLevel.find_by(script_id: Script::JIGSAW_ID, chapter: 3)
    assert_routing({method: "get", path: '/jigsaw/3'},
                   {controller: "script_levels", action: "show", script_id: Script::JIGSAW_ID, chapter: "3"})
    assert_equal "/jigsaw/3", build_script_level_path(jigsaw_level)
  end

  test "test step script routing" do
    script = Script.find_by_name 'step'
    step_level = ScriptLevel.find_by script: script, chapter: 3
    assert_routing({method: "get", path: '/s/step/puzzle/3'},
                   {controller: "script_levels", action: "show", script_id: 'step', chapter: "3"})
    assert_equal "/s/step/puzzle/3", build_script_level_path(step_level)
  end


  test "routing for custom scripts with stage" do
    assert_routing({method: "get", path: "/s/laurel/stage/1/puzzle/1"},
                   {controller: "script_levels", action: "show", script_id: 'laurel', stage_id: "1", id: "1"})
    assert_equal "/s/laurel/stage/1/puzzle/1", build_script_level_path(@custom_s1_l1)

    assert_routing({method: "get", path: "/s/laurel/stage/2/puzzle/1"},
                   {controller: "script_levels", action: "show", script_id: 'laurel', stage_id: "2", id: "1"})
    assert_equal "/s/laurel/stage/2/puzzle/1", build_script_level_path(@custom_s2_l1)

    assert_routing({method: "get", path: "/s/laurel/stage/2/puzzle/2"},
                   {controller: "script_levels", action: "show", script_id: 'laurel', stage_id: "2", id: "2"})
    assert_equal "/s/laurel/stage/2/puzzle/2", build_script_level_path(@custom_s2_l2)
  end

  test "show redirects to canonical url for hoc" do
    hoc_level = Script.find(Script::HOC_ID).script_levels.second
    get :show, script_id: Script::HOC_ID, id: hoc_level.id

    assert_response 301 # moved permanently
    assert_redirected_to '/hoc/2'
  end
  
  test "should show special script level by chapter" do
    @controller.expects :slog

    # this works for 'special' scripts like flappy, hoc
    expected_script_level = ScriptLevel.where(script_id: Script::FLAPPY_ID, chapter: 5).first

    get :show, script_id: Script::FLAPPY_ID, chapter: '5'
    assert_response :success

    assert_equal expected_script_level, assigns(:script_level)
  end

  test "show redirects to canonical url for special scripts" do
    flappy_level = Script.find(Script::FLAPPY_ID).script_levels.second
    get :show, script_id: Script::FLAPPY_ID, id: flappy_level.id

    assert_response 301 # moved permanently
    assert_redirected_to '/flappy/2'
  end

  test "should show script level by stage and puzzle position" do
    @controller.expects :slog

    # this works for custom scripts

    get :show, script_id: @custom_script, stage_id: 2, id: 1

    assert_response :success

    assert_equal @custom_s2_l1, assigns(:script_level)
  end

  test "show redirects to canonical url for custom scripts" do
    get :show, script_id: @custom_script.id, id: @custom_s2_l1

    assert_response 301 # moved permanently
    assert_redirected_to '/s/laurel/stage/2/puzzle/1'
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
    assert assigns(:callouts).find{|c| c['localized_text'] == 'Hit "Run" to try your program'}
  end
  
  test "should render blockly partial for blockly levels" do
    @controller.expects :slog

    script = create(:script)
    level = create(:level, :blockly)
    stage = create(:stage, script: script)
    script_level = create(:script_level, script: script, level: level, stage: stage)

    get :show, script_id: script.name, stage_id: stage, id: script_level.position

    assert_equal script_level, assigns(:script_level)
    
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

  test 'should render title for puzzle in default script' do
    get :show, script_id: @script.id, id: @script_level.id
    assert_equal 'Code.org - The Maze #4',
      Nokogiri::HTML(@response.body).css('title').text.strip
  end

  test 'should render title for puzzle in custom script' do
    get :show, script_id: @custom_script.name, stage_id: @custom_s2_l1.stage, id: @custom_s2_l1.position
    assert_equal 'Code.org - custom-script-laurel: laurel-stage-2 #1',
      Nokogiri::HTML(@response.body).css('title').text.strip
  end
end
