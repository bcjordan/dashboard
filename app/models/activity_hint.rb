# Links an Activity to a LevelSourceHint
class ActivityHint < ActiveRecord::Base
  belongs_to :activity
  belongs_to :level_source_hint

  private
  # Experiments
  @is_experimenting_feedback = true

  def self.is_experimenting_feedback?
    @is_experimenting_feedback
  end

end
