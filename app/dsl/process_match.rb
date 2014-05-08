class ProcessMatch < ProcessDSL
  def name(text) @name = text end
  def title(text) @hash[:title] = text end
  def description(text) @hash[:description] = text end
  def question(text) @hash[:questions] << { text: text } end

  def answer(text, correct=nil)
    answer = {text: text}
    answer[:correct] = correct unless correct.nil?
    @hash[:answers] << answer
  end

  @hash = { :questions => [], :answers => [] }

  def parse(filename)
    super
    [{ name: @name, properties: @hash }, i18n_hash]
  end

  def i18n_hash
    strings = {}
    strings[@hash[:title]] = @hash[:title]
    strings[@hash[:description]] = @hash[:description]
    @hash[:questions].each do |question|
      text = question[:text]
      strings[text] = text
    end
    @hash[:answers].each do |answer|
      text = answer[:text]
      strings[text] = text
    end

    {"en" => { "data" => { suffix => { @name => strings }}}}
  end

end

