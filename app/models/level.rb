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
  after_save :write_custom_levels_to_file if Rails.env == "staging" && !ENV["FORCE_CUSTOM_LEVELS"]
  after_destroy :write_custom_levels_to_file if Rails.env == "staging" && !ENV["FORCE_CUSTOM_LEVELS"]
  after_initialize :init

  def init
    self.properties  ||= {}
  end

  # https://github.com/rails/rails/issues/3508#issuecomment-29858772
  # Include type in serialization.
  def serializable_hash(options=nil)
    super.merge "type" => type
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

  # Overriden by different level types.
  def self.step_modes
  end

  # Overriden by different level types.
  def self.flower_types
  end

  def self.custom_levels
    Naturally.sort_by(Level.where.not(user_id: nil), :name)
  end

  def write_custom_levels_to_file
    File.open(Rails.root.join("config", "scripts", "custom_levels.json"), 'w+') do |file|
      levels = Level.custom_levels
      levels_json = levels.as_json
      levels_json.each do |level|
        %w(maze initial_dirt final_dirt).map do |maze_type|
          level['properties'][maze_type] &&= level['properties'][maze_type].to_json
        end
        level.delete 'id'
        level.reject! { |k, v| v.nil? }
      end
      file << JSON.pretty_generate(levels_json)
    end
  end

  def self.update_unplugged
    # Unplugged level data is specified in 'unplugged.en.yml' file
    unplugged = I18n.t('data.unplugged')
    unplugged_game = Game.find_by(name: 'Unplugged')
    unplugged.map do |name,_|
      Level.where(name: name).first_or_create.update(
        type: 'Unplugged',
        game: unplugged_game
      )
    end
  end
end
