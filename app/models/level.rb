# An individual Blockly level definition
class Level < ActiveRecord::Base
  serialize :properties, JSON
  belongs_to :game
  has_and_belongs_to_many :concepts
  belongs_to :solution_level_source, :class_name => "LevelSource"
  belongs_to :user
  validates_length_of :name, within: 1..70
  validates_uniqueness_of :name, conditions: -> { where.not(user_id: nil) }
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

  def complete_toolbox
    '<xml></xml>'
  end

  def self.custom_levels
    where("user_id IS NOT NULL")
  end

  def write_custom_levels_to_file
    File.open(Rails.root.join("config", "scripts", "custom_levels.json"), 'w+') do |file|
      levels = Level.custom_levels
      levels.each {|level| level.properties.update(solution_blocks: level.solution_level_source.try(:data))}
      file << levels.to_json
    end
  end

  # contents - should respond to read by returning a 2d square array
  #   with the given size, representing a blockly level.
  # Throws ArgumentError if there is a non integer value in the array.
  def self.read_and_convert_maze_to_integer(contents, size)
    raw_maze = contents.read[0...size]
    raw_maze.map {|row| row.map {|cell| Integer(cell)}}
  end

  # Parses the 2d array contents.
  # If type is "maze" return a single entry hash with 'maze' mapping to a 2d
  #   array that Blockly can render.
  # If type is "karel" return a 3 entry hash with keys 'maze', 'initial_dirt',
  #   and 'final_dirt', the keys map to 2d arrays blockly can render.
  # Throws ArgumentError if there is a non integer value in the array.
  def self.parse_maze(contents, type, size)
    maze = read_and_convert_maze_to_integer(contents, size)

    type == 'maze' ? { 'maze' => maze } : parse_karel_maze(maze, size)
  end

  # Karel level builder mazes have the information for three 2D arrays embeded
  #   into one.
  # final_dirt is always zeroed out until it is removed from Blockly.
  def self.parse_karel_maze(maze, size)
    map, initial_dirt, final_dirt = (0...3).map { Array.new(size) { Array.new(size, 0) }}

    maze.each_with_index do |row, x|
      row.each_with_index do |cell, y|
        (cell >= 100 ? map : initial_dirt)[x][y] = cell % 100
      end
    end

    { 'maze' => map, 'initial_dirt' => initial_dirt, 'final_dirt' => final_dirt }
  end
end
