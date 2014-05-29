# A sequence of Levels
class Script < ActiveRecord::Base
  include Seeded
  has_many :levels, through: :script_levels
  has_many :script_levels, -> { order("chapter ASC") }, dependent: :destroy # all script levels, even those w/ stages, are ordered by chapter, see Script#add_script
  has_many :stages, -> { order("position ASC") }
  belongs_to :wrapup_video, foreign_key: 'wrapup_video_id', class_name: 'Video'
  belongs_to :user
  validates_uniqueness_of :name, allow_nil: false, allow_blank: false, case_sensitive: false

  # Hardcoded scriptID constants used throughout the code
  TWENTY_HOUR_ID = 1
  HOC_ID = 2
  EDIT_CODE_ID = 3
  TWENTY_FOURTEEN_LEVELS_ID = 4
  BUILDER_ID = 5
  FLAPPY_ID = 6
  JIGSAW_ID = 7

  MAX_DEFAULT_LEVEL_ID = 8

  def self.twenty_hour_script
    @@twenty_hour_script ||= Script.includes(script_levels: { level: [:game, :concepts] }).find(TWENTY_HOUR_ID)
  end

  def self.hoc_script
    @@hoc_script ||= Script.includes(script_levels: { level: [:game, :concepts] }).find(HOC_ID)
  end

  def self.get_from_cache(id)
    case id
    when TWENTY_HOUR_ID then twenty_hour_script
    when HOC_ID then hoc_script
    else
      # a bit of trickery so we support both ids which are numbers and
      # names which are strings that may contain numbers (eg. 2-3)
      find_by = (id.to_i.to_s == id.to_s) ? :id : :name
      Script.find_by(find_by => id).tap do |s|
        raise ActiveRecord::RecordNotFound.new("Couldn't find Script with id|name=#{id}") unless s
      end
    end
  end

  def to_param
    if self.twenty_hour? || self.hoc?
      super
    else
      name
    end
  end

  def script_levels_from_game(game_id)
    self.script_levels.select { |sl| sl.level.game_id == game_id }
  end

  def multiple_games?
    # simplified check to see if we are in a script that has only one game (stage)
    levels.first.game_id != levels.last.game_id
  end

  def twenty_hour?
    self.id == TWENTY_HOUR_ID
  end

  def hoc?
    self.id == HOC_ID
  end

  def default_script?
    self.id <= MAX_DEFAULT_LEVEL_ID
  end

  def find_script_level(level_id)
    self.script_levels.detect { |sl| sl.level_id == level_id }
  end

  def self.twenty_hour_script
    Script.find(TWENTY_HOUR_ID)
  end

  def self.builder_script
    Script.find(BUILDER_ID)
  end

  def get_script_level_by_id(script_level_id)
    script_level_id = script_level_id.to_i
    self.script_levels.select { |sl| sl.id == script_level_id }.first
  end

  def get_script_level_by_stage_and_position(stage_position, puzzle_position)
    self.stages.find_by(position: stage_position).script_levels.find_by(position: puzzle_position)
  end

  def get_script_level_by_chapter(chapter)
    chapter = chapter.to_i
    self.script_levels.select { |sl| sl.chapter == chapter }.first
  end

  SCRIPT_CSV_MAPPING = %w(Game Name Level:level_num Skin Concepts Url:level_url Stage)
  SCRIPT_MAP = Hash[SCRIPT_CSV_MAPPING.map { |x| x.include?(':') ? x.split(':') : [x, x.downcase] }]

  def self.setup(default_files, custom_files)
    transaction do
      # Load default scripts from yml (csv embedded)
      default_scripts = default_files.map { |yml| load_yaml(yml, SCRIPT_MAP) }
      .sort_by { |options, _| options['id'] }
      .map { |options, data| add_script(options, data) }

      custom_i18n = {}
      # Load custom scripts from Script DSL format
      custom_scripts = custom_files.map do |script|
        script_data, i18n = ScriptDSL.parse_file(script)
        custom_i18n.deep_merge!(i18n)
        add_script({name: File.basename(script, '.script'), trophies: false, hidden: true},
          script_data.map{|stage| stage[:levels]}.flatten)
      end
      [(default_scripts + custom_scripts), custom_i18n]
    end
  end

  def self.add_script(options, data)
    script = fetch_script(options)
    chapter = 0; game_chapter = Hash.new(0)
    # Clear positions in case script levels or stages are deleted.
    script.script_levels.each { |script_level| script_level.update(position: nil) }
    script.stages.each { |stage| stage.update(position: nil) }
    # Overwrites current script levels
    script.script_levels = data.map do |row|
      row.symbolize_keys!

      # Concepts are comma-separated, indexed by name
      row[:concept_ids] = (concepts = row.delete(:concepts)) && concepts.split(',').map(&:strip).map do |concept_name|
        (Concept.find_by_name(concept_name) || raise("missing concept '#{concept_name}'")).id
      end

      if row[:name].try(:start_with?, 'blockly:')
        row[:name], row[:game], row[:level_num] = row.delete(:name).split(':')
      end

      # if :level_num is present, find/create the reference to the Blockly level.
      level = row[:level_num] ?
        Level.create_with(name: row.delete(:name)).find_or_create_by!(game: Game.find_by(name: row.delete(:game)), level_num: row[:level_num]) :
        Level.find_by!(name: row.delete(:name))

      raise "Level #{level.to_json}, does not have a game." if level.game.nil?
      stage = row.delete(:stage)
      level.update(row)

      script_level = ScriptLevel.where(
        script: script,
        level: level,
        chapter: (chapter += 1),
        game_chapter: (game_chapter[level.game] += 1)
      ).first_or_create

      # Set/create Stage containing custom ScriptLevel
      if stage
        stage_object = Stage.where(name: stage, script: script).first_or_create
        stage_object.insert_at(0)
        stage_object.move_to_bottom

        script_level.update(stage: stage_object)
        script_level.insert_at(0)
        script_level.move_to_bottom
      end
      script_level
    end
    script.stages.each { |stage| stage.destroy if stage.script_levels.empty? }  # Remove empty stages.
    script.reload.stages # Otherwise cached destroyed stages will still be in returned script object
    script
  end

  # script is found/created by 'id' (if provided) otherwise by 'name'
  def self.fetch_script(options)
    options.symbolize_keys!
    v = :wrapup_video; options[v] = Video.find_by(key: options[v]) if options.has_key? v
    name = {name: options.delete(:name)}
    script_key = ((id = options.delete(:id)) && {id: id}) || name
    script = Script.create_with(name).find_or_create_by(script_key)
    script.update!(options)
    script
  end

  def update_text(script_params, script_text)
    begin
      transaction do
        script_data, i18n = ScriptDSL.parse(script_text, script_params[:name])
        Script.add_script({name: script_params[:name], trophies: false, hidden: true},
          script_data.map { |stage| stage[:levels] }.flatten)
        Script.update_i18n(i18n)
      end
    rescue Exception => e
      errors.add(:base, e.to_s)
      return false
    end
    begin
      # write script to file
      filename = "config/scripts/#{script_params[:name]}.script"
      File.write(filename, script_text)
      Script.rake
      true
    rescue Exception => e
      errors.add(:base, e.to_s)
      return false
    end
  end

  def self.rake
    # cf. http://stackoverflow.com/a/9943895
    require 'rake'
    Rake::Task.clear
    Dashboard::Application.load_tasks
    Rake::FileTask['config/scripts/.seeded'].invoke
  end

  def self.update_i18n(custom_i18n)
    scripts_yml = File.expand_path('config/locales/scripts.en.yml')
    i18n = File.exists?(scripts_yml) ? YAML.load_file(scripts_yml) : {}
    i18n.deep_merge!(custom_i18n) { |i, old, new| old } # deep reverse merge
    File.write(scripts_yml, "# Autogenerated scripts locale file.\n" + i18n.to_yaml)
  end

end
