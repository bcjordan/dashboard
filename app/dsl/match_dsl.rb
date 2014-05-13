class MatchDSL < BaseDSL
  def initialize
    @hash = { :questions => [], :answers => [] }
  end

  def title(text) @hash[:title] = text end
  def description(text) @hash[:description] = text end
  def banner(text) @hash[:banner] = text end
  def height(text) @hash[:height] = text end
  def question(text) @hash[:questions] << { text: text } end

  def answer(text, correct=nil)
    answer = {text: text}
    answer[:correct] = correct unless correct.nil?
    @hash[:answers] << answer
  end

  def parse_output
    {name: @name, properties: @hash}
  end

  def i18n_strings
    strings = {}
    strings[@hash[:title]] = @hash[:title]
    strings[@hash[:description]] = @hash[:description] unless @hash[:description].blank?
    strings[@hash[:banner]] = @hash[:banner] unless @hash[:banner].blank?
    @hash[:questions].each do |question|
      text = question[:text]
      strings[text] = text
    end
    @hash[:answers].each do |answer|
      text = answer[:text]
      strings[text] = text
    end
    {@name => strings}
  end

end

