# Maps to an individual Blockly level definition
# "name" is unique in custom-built levels
class Level < ActiveRecord::Base
  serialize :properties, JSON
  belongs_to :game
  has_and_belongs_to_many :concepts
  has_many :script_levels, dependent: :destroy
  belongs_to :solution_level_source, :class_name => "LevelSource"
  belongs_to :user
  validates_length_of :name, within: 1..70
  validates_uniqueness_of :name, case_sensitive: false, conditions: -> { where.not(user_id: nil) }
  after_save :write_custom_levels_to_file if Rails.env == "staging"
  after_initialize :init

  def init
    self.properties  ||= {}
  end

  def self.builder
    @@level_builder ||= find_by_name('builder')
  end

  def videos
    ([game.intro_video] + concepts.map(&:video)).reject(&:nil?)
  end

  def complete_toolbox(type)
    "<xml id='toolbox' style='display: none;'>#{toolbox(type)}</xml>"
  end

  # Overriden by different level types.
  def toolbox(type)
  end

  # Overriden by different level types.
  def self.skins
    []
  end

  # Overriden by different level types.
  def self.start_directions
  end

  def self.custom_levels
    where("user_id IS NOT NULL")
  end

  def write_custom_levels_to_file
    File.open(Rails.root.join("config", "scripts", "custom_levels.json"), 'w+') do |file|
      levels = Level.custom_levels
      file << levels.to_json
    end
  end
end
