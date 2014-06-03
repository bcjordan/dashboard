class ExperimentActivity < ActiveRecord::Base

  belongs_to :activity

  private
  # Experiments
  @@is_experimenting_feedback_design = false

  # Experiment types
  TYPE_FEEDBACK_DESIGN_WHITE = 'white_background'
  TYPE_FEEDBACK_DESIGN_YELLOW = 'yellow_background'
  TYPES_FEEDBACK_DESIGN = [ TYPE_FEEDBACK_DESIGN_WHITE, TYPE_FEEDBACK_DESIGN_YELLOW ]

  public
  def white_background?
    self.feedback_design == TYPE_FEEDBACK_DESIGN_WHITE
  end

  def yellow_background?
    self.feedback_design == TYPE_FEEDBACK_DESIGN_YELLOW
  end

  def self.is_experimenting_feedback_design?
    @@is_experimenting_feedback_design
  end

  def self.set_experimenting_feedback_design(is_active)
    @@is_experimenting_feedback_design = is_active;
  end

  def self.get_feedback_design(activity_id)
    if activity_id
      activity = Activity.find(activity_id)
      # Select the design to be experimented on
      if activity.user_id
        target_design = TYPES_FEEDBACK_DESIGN[activity.user_id % TYPES_FEEDBACK_DESIGN.length]
        # Record
        ExperimentActivity.create(activity_id: activity_id, feedback_design: target_design);
        target_design
      end
    end
  end

  TYPE_FEEDBACK_DEFAULT = 0
  TYPE_FEEDBACK_CROWDSOURCED = 1
  TYPE_FEEDBACK_BEST_NEXT = 2
  TYPES_FEEDBACK_SOURCES = [ TYPE_FEEDBACK_DEFAULT, TYPE_FEEDBACK_CROWDSOURCED, TYPE_FEEDBACK_BEST_NEXT ]

end
