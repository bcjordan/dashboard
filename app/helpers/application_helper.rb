require 'nokogiri'

module ApplicationHelper

  include LocaleHelper

  def ago(from_time)
    s = distance_of_time_in_words_to_now(from_time)
    # XXX This is horribly broken for localization.
    s = s.gsub("about ", "")
    s = s.gsub("less than ", "")
    s = s.gsub("a minute", "1 minute")
    "#{s} ago"
  end

  def safari?(agent = request.user_agent)
    return true if agent =~ /Safari/
  end

  def mobile?(agent = request.user_agent)
    return true if agent =~ /\b(iPad|urbanpad)\b/
    return true if agent =~ /BlackBerry|BB10.*mobile/i
    return true if agent =~ /Android/
    return true if agent =~ /\b(iPhone|iPod|CFNetwork)\b/
    return true if agent =~ /Windows Phone/

    #return true if agent =~ /^(?:ASTEL|AU-MIC|DoCoMo|J-PHONE|mot|Nokia|PDXGW|SEC|SonyEricsson|UPG1|Vodafone|Xiino)/i
    #return true if agent =~ /\b(?:Android|AvantGo|Danger|DDIPOCKET|Elaine|embedix|maemo|MIDP|NetFront|nokia\d+|Opera Mini|Palm(OS|Source)|PlayStation|ProxiNet|RegKing|ReqwirelessWeb|SonyEricsson|Symbian ?OS|TELECA|Twitt[a-z]+|UP\.Browser|WinWAPDashMR|Windows CE|Pre)\b/i
    false
  end

  def phone?(agent = request.user_agent)
    # return true if agent =~ /\b(iPad|urbanpad)\b/
    return true if agent =~ /BlackBerry|BB10.*mobile/i
    return true if agent =~ /Android/
    return true if agent =~ /\b(iPhone|iPod|CFNetwork)\b/
    return true if agent =~ /Windows Phone/

    #return true if agent =~ /^(?:ASTEL|AU-MIC|DoCoMo|J-PHONE|mot|Nokia|PDXGW|SEC|SonyEricsson|UPG1|Vodafone|Xiino)/i
    #return true if agent =~ /\b(?:Android|AvantGo|Danger|DDIPOCKET|Elaine|embedix|maemo|MIDP|NetFront|nokia\d+|Opera Mini|Palm(OS|Source)|PlayStation|ProxiNet|RegKing|ReqwirelessWeb|SonyEricsson|Symbian ?OS|TELECA|Twitt[a-z]+|UP\.Browser|WinWAPDashMR|Windows CE|Pre)\b/i
    false
  end

  # Returns ie version or 0 if not ie
  def ie_version
    browser = request.user_agent
    match = /MSIE (\d.\d*)/.match(browser)
    match ? match[1].to_i : 0
  end

  # Returns Chrome version or 0 if not Chrome
  def chrome_version
    browser = request.user_agent
    match = /Chrome\/(\d+)\./.match(browser)
    match ? match[1].to_i : 0
  end

  def youtube_url(code, args={})
    defaults = {
      v: code,
      modestbranding: 1,
      rel: 0,
      showinfo: 1,
      autoplay: 1,
      wmode: 'transparent',
      iv_load_policy: 3
    }
    if language != 'en'
      defaults.merge!(
        cc_lang_pref: language,
        cc_load_policy: 1
      )
    end
    defaults.merge!(args)
    "#{youtube_base_url}/embed/#{code}/?#{defaults.to_query}"
  end
  
  def youtube_base_url
    'https://www.youtubeeducation.com'
  end

  def video_thumbnail_url(video)
    asset_url(video_thumbnail_path(video))
  end

  def video_thumbnail_path(video)
    "/c/video_thumbnails/#{video.id}.jpg"
  end

  def video_info(video)
    # Note: similar video info is also set in javascript at levels/_blockly.html.haml
    { src: youtube_url(video.youtube_code), key: video.key, name: data_t('video.name', video.key), download: video.download, thumbnail: video_thumbnail_path(video), enable_fallback: false }
  end

  def format_xml(xml)
    doc = Nokogiri::XML(xml)
    doc.to_xhtml
  end

  def level_box_class(best_result)
    if !best_result then 'level_untried'
    elsif best_result == Activity::BEST_PASS_RESULT || best_result == Activity::FREE_PLAY_RESULT then 'level_aced'
    elsif best_result < Activity::MINIMUM_PASS_RESULT then 'level_undone'
    else 'level_done'
    end
  end

  def gender_options
    User::GENDER_OPTIONS.map do |key, value|
      [(key ? t(key) : ''), value]
    end
  end

  def bullet_html
    #raw "&#9679;"
    image_tag('white-dot-grid.png')
  end

  def check_mark_html
    #raw "&#x2714;"
    image_tag('white-checkmark.png')
  end
  
  def eligible_for_prize?
    # check IP for US users only (ideally, we'd check if the teacher is in the US for teacher prizes)
    # If the geolocation fails, assume non-US.
    request.location.try(:country_code) == 'US'
  end

  def level_info(user, script_level)
    passed = level_passed({user: user, user_level: script_level.user_level, level_id: script_level.level_id})
    link = build_script_level_path(script_level)
    [passed, link]
  end

  def show_flashes
    ret = ""
    if notice
      ret += content_tag(:p, flash.notice, {id: "notice"})
      flash.notice = nil
    end

    if alert
      ret += content_tag(:p, flash.alert, {id: "alert"})
      flash.alert = nil
    end

    ret
  end
end
