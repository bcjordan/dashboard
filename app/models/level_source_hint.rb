# A "hint" text displayed for a specific LevelSource to guide the player to a solution
class LevelSourceHint < ActiveRecord::Base
  belongs_to :level_source
  has_many :activity_hints

  STATUS_SELECTED = 'selected'
  STATUS_EXPERIMENT = 'experiment'
  STATUS_INACTIVE = 'inactive'

  def selected?
    self.status == STATUS_SELECTED
  end

  def experiment?
    self.status == STATUS_EXPERIMENT
  end

  def inactive?
    self.status == STATUS_INACTIVE
  end

end