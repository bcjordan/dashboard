# Joins a Script to a Level
# A Script has one or more Levels, and a Level can belong to one or more Scripts
class ScriptLevel < ActiveRecord::Base
  belongs_to :level
  belongs_to :script
  belongs_to :stage
  acts_as_list scope: :stage

  NEXT = 'next'

  # this is a temporary (request-scope) variable set by User.rb#levels_from_script to find the UserLevel
  # corresponding to this ScriptLevel for a specific user
  attr_accessor :user_level

  def next_level
    if self.stage
      # Either choose next script_level, or attempt first script_level next stage.
      self.lower_item || self.stage.lower_item.try(:script_levels).try(:first) # Last level is at position 1
    else
      self.script.try(:get_script_level_by_chapter, self.chapter + 1)
    end
  end

  def previous_level
    if self.stage
      self.higher_item
    else
      self.script.try(:get_script_level_by_chapter, self.chapter - 1)
    end
  end

  def end_of_stage?
    stage ? (self.last?) :
      level.game_id != next_level.level.game_id
  end

  def stage_position_str
    "#{stage ? "#{I18n.t('stage')} #{stage.position}" : I18n.t("data.script.name.#{script.name}.#{level.game.name}")}"
  end

  def name
    I18n.t("data.script.name.#{script.name}.#{stage ? stage.name : level.game.name}")
  end

  def stage_or_game_position
    self.stage ? self.position : self.game_chapter
  end

  def stage_or_game_total
    stage ? stage.script_levels.count :
    script.script_levels_from_game(level.game_id).count
  end

  def self.cache_find(id)
    @@script_level_map ||= ScriptLevel.includes(:level, :script).index_by(&:id)
    @@script_level_map[id]
  end

  def solved(response, application)
    new_level = next_level
    # If this is the end of the current script
    unless new_level
      # If the current script is hour of code, continue on to twenty-hour
      if script.hoc?
        new_level = Script.twenty_hour_script.get_script_level_by_chapter(chapter + 1)
        redirect = current_user ? application.build_script_level_path(new_level) : 'http://code.org/api/hour/finish'
      else
        response[:redirect] = application.root_path
        redirect = nil
      end
      # Get the wrap up video
      video = script.wrapup_video
      if video
        video_info_response = application.video_info(video)
        video_info_response[:redirect] = redirect
        response[:video_info] = video_info_response
      end
      response[:message] = 'no more levels'
    end
    # Get the new_level setup
    if new_level
      response[:redirect] = application.build_script_level_path(new_level)
      if end_of_stage?
        response[:stage_changing] = {
          previous: { number: level.game_id, name: name },
          new: { number: new_level.level.game_id, name: new_level.name }
        }
      end
      if level.skin != new_level.level.skin
        response[:skin_changing] = { previous: level.skin, new: new_level.level.skin }
      end
    end
  end

end
