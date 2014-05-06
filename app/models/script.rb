# A sequence of Levels
class Script < ActiveRecord::Base
  include Seeded
  has_many :levels, through: :script_levels
  has_many :script_levels, dependent: :destroy
  has_many :stages
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
      else Script.includes(script_levels: { level: [:game, :concepts] }).find(id)
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
    self.script_levels.select { |sl| sl.id == script_level_id }.first
  end

  def get_script_level_by_chapter(chapter)
    self.script_levels.select { |sl| sl.chapter == chapter }.first
  end

  SCRIPT_CSV_MAPPING = %w(Game Name Level:level_num Skin Concepts Url:level_url Stage)
  SCRIPT_MAP = Hash[SCRIPT_CSV_MAPPING.map { |x| x.include?(':') ? x.split(':') : [x, x.downcase] }]

  def self.setup(default_scripts, custom_scripts)
    transaction do
      # Load default scripts from yml (csv embedded)
      default_scripts.map { |yml| load_yaml(yml, SCRIPT_MAP) }
      .sort_by { |options, _| options['id'] }
      .map { |options, data| add_script(options, data) }

      # Load custom scripts from generate_scripts ruby DSL (csv as intermediate format)
      custom_scripts.map do |script|
        add_script(
          {name: File.basename(script, ".script"), trophies: false, hidden: true},
          parse_csv(`config/generate_scripts #{script}`, "\t", SCRIPT_MAP),
          true
        )
      end
    end
  end

  def self.add_script(options, data, custom=false)
    script = fetch_script(options)
    chapter = 0; game_chapter = Hash.new(0)
    script.script_levels = data.map do |row|
      row.symbolize_keys!

      # Concepts are comma-separated, indexed by name
      row[:concept_ids] = (concepts = row.delete(:concepts)) && concepts.split(',').map(&:strip).map do |concept_name|
        (Concept.find_by_name(concept_name) || raise("missing concept '#{concept_name}'")).id
      end

      # Reference one Level per element
      level = custom ?
        Level.find_by(name: row[:name]) :
        Level.where(game: Game.find_by(name: row.delete(:game)), level_num: row[:level_num]).first_or_create

      raise "There does not exist a level with the name '#{row[:name]}'. From the row: #{row}" if level.nil?
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
        script_level.update(stage: Stage.where(name: stage, script: script).first_or_create)
        script_level.move_to_bottom
      end
      script_level
    end
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

  def self.update_script_locales
    scripts_locale_file = File.expand_path('config/locales/scripts.en.yml')
    locale_hash = YAML.load_file(scripts_locale_file) ||
      {'en' => {'data' => {'script' => {'name' => {}}}}}
    script_names = locale_hash['en']['data']['script']['name']
    Script.all.map do |script|
      script_name = script.name
      script_names[script_name] = {} unless I18n.exists?("data.script.name.#{script_name}.desc", 'en')
      if script_names.include? script_name
        script_locale = script_names[script_name]
        script_locale['desc'] ||= "Custom script #{script_name}"
        script.stages.map { |stage| script_locale[stage.name] ||= stage.name }
      end
    end
    File.write(scripts_locale_file, "# Autogenerated scripts locale file.\n" + locale_hash.to_yaml)
  end
end
