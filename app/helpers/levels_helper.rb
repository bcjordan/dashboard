module LevelsHelper
  def build_script_level_path(script_level)
    if Script::HOC_ID == script_level.script_id
      hoc_chapter_path(script_level.chapter)
    else
      script_level_path(script_level.script, script_level)
    end
  end

  def build_script_level_url(script_level)
    url_from_path(build_script_level_path(script_level))
  end

  def url_from_path(path)
    "#{root_url.chomp('/')}#{path}"
  end

  def set_videos_and_blocks_and_callouts
    solution = @level.solution_level_source
    @solution_blocks = solution.data if solution

    @videos = @level.videos

    seen_videos = session[:videos_seen] || Set.new()
    @videos.each do |v|
      if !seen_videos.include?(v.key)
        @autoplay_video_info = params[:noautoplay] ? nil : video_info(v)
        seen_videos.add(v.key)
        session[:videos_seen] = seen_videos
        break
      end
    end

    @toolbox_blocks = @toolbox_blocks || @level.toolbox_blocks
    @start_blocks = initial_blocks(current_user, @level) || @start_blocks || @level.start_blocks

    select_and_remember_callouts if @script_level
  end

  def select_and_remember_callouts
    session[:callouts_seen] ||= Set.new()
    @callouts_to_show = Callout.where(script_level: @script_level)
      .select(:id, :element_id, :qtip_config, :localization_key)
      .reject { |c| session[:callouts_seen].include?(c.localization_key) }
      .each { |c| session[:callouts_seen].add(c.localization_key) }
    @callouts = make_localized_hash_of_callouts(@callouts_to_show)
  end

  def make_localized_hash_of_callouts(callouts)
    callouts.map do |callout|
      callout_hash = callout.attributes
      callout_hash.delete('localization_key')
      callout_hash['localized_text'] = data_t('callout.text', callout.localization_key)
      callout_hash
    end
  end

  # this defines which levels should be seeded with th last result from a different level
  def initial_blocks(user, level)
    if params[:initial_code]
      return params[:initial_code]
    end

    if user
      if level.game.app == 'turtle'
        from_level_num = case level.level_num
          when '3_8' then '3_7'
          when '3_9' then '3_8'
        end

        if from_level_num
          from_level = Level.find_by_game_id_and_level_num(level.game_id, from_level_num)
          return user.last_attempt(from_level).try(:level_source).try(:data)
        end
      end
    end
    nil
  end

  # XXX Since Blockly doesn't play nice with the asset pipeline, a query param
  # must be specified to bust the CDN cache. CloudFront is enabled to forward
  # query params. Don't cache bust during dev, so breakpoints work.
  # See where ::CACHE_BUST is initialized for more details.
  def blockly_cache_bust
    if ::CACHE_BUST.blank?
      false
    else
      ::CACHE_BUST
    end
  end


  def show_image(params)
    if params[:id]
      level_source = LevelSource.find(params[:id])
      app = level_source.level.game.app
    else
      app = params[:app]
    end

    if app == 'flappy'
      request.protocol + request.host_with_port + ActionController::Base.helpers.asset_path('flappy_sharing_drawing.png')
    elsif app == 'bounce'
      request.protocol + request.host_with_port + ActionController::Base.helpers.asset_path('bounce_sharing_drawing.png')
    else
      level_source_image = LevelSourceImage.find_by_level_source_id(level_source.id)
      if !level_source_image.nil? && !level_source_image.image.nil?
        url_for(:controller => "level_sources", :action => "generate_image", :id => params[:id], only_path: false)
      else
        request.protocol + request.host_with_port + ActionController::Base.helpers.asset_path('sharing_drawing.png')
      end
    end
  end

  # Code for generating the blockly options hash
  def blockly_options(local_assigns={})
    # Use values from properties json when available (use String keys instead of Symbols for consistency)
    level = @level.properties.dup || {}

    # Set some specific values
    level['puzzle_number'] = @script_level ? @script_level.game_chapter : 1
    level['stage_total'] = @script ? @script.script_levels_from_game(@level.game_id).length : @level.game.levels.count
    if @level.step_mode
      level['step'] = @level.step_mode == 1 || @level.step_mode == 2
      level['stepOnly'] = @level.step_mode == 2
    end

    # Map Dashboard-style names to Blockly-style names in level object.
    # Dashboard underscore_names mapped to Blockly lowerCamelCase, or explicit 'Dashboard:Blockly'
    Hash[%w(
      start_blocks solution_blocks slider_speed start_direction instructions initial_dirt final_dirt
      toolbox_blocks:toolbox
      x:initialX
      y:initialY
      maze:map
      artist_builder:builder
    ).map{ |x| x.include?(':') ? x.split(':') : [x,x.camelize(:lower)]}]
    .each do |dashboard, blockly|
      # Select first valid value from 1. local_assigns, 2. property of @level object, 3. named instance variable, 4. properties json
      # Don't override existing valid (non-nil/empty) values
      property = local_assigns[dashboard].presence ||
        @level[dashboard].presence ||
        instance_variable_get("@#{dashboard}").presence ||
        level[dashboard.to_s].presence
      level[blockly.to_s] ||= property if property.present?
    end

    # Blockly requires startDirection as an integer not a string
    level['startDirection'] = level['startDirection'].to_i if level['startDirection'].present?

    # Blockly requires map as an array not a string
    level['map'] = JSON.parse(level['map']) if level['map'].is_a? String

    # Fetch localized strings
    %w(instructions levelIncompleteError other1StarError tooFewBlocksMsg).each do |label|
      level[label] ||= [@level.game.app, @level.game.name].map { |name|
        data_t("level.#{label}", "#{name}_#{@level.level_num}")
      }.compact!.first
    end

    # Set some values that Blockly expects on the root of its options string
    app_options = {'levelId' => @level.level_num}
    app_options['scriptId'] = @script.id if @script
    app_options['levelGameName'] = @level.game.name if @level.game
    [level, app_options]
  end
end
