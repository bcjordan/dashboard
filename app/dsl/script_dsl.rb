class ScriptDSL < BaseDSL
  def initialize
    super
    @stage = nil
    @concepts = []
    @skin = nil
    @levels = []
    @stages = []
    @i18n_strings = Hash.new({})
  end

  def stage(name)
    @stages << {stage: @stage, levels: @levels} if @stage
    @stage = name
    @levels = []
    @concepts = []
    @skin = nil
  end

  def parse_output
    stage(nil)
    @stages
  end

  def concepts(*items)
    @concepts = items
  end

  def skin(name)
    @skin = name
  end

  def level(name)
    @levels << {
      :name => name,
      :skin => @skin,
      :concepts => @concepts.join(',')
    }.select{|_, v| v.present? }
  end

  def i18n_strings
    @stages.each do |stage|
      @i18n_strings[stage[:stage]] = stage[:stage]
    end

    @i18n_strings['desc'] = "Custom script #{@name}"
    {'name'=> {@name => @i18n_strings}}
  end

  def self.parse_file(filename)
    super(filename, File.basename(filename, '.script'))
  end
end
