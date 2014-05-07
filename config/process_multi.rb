require 'yaml'

class ProcessMulti

  def name(text)
    @name = text
  end

  def title(text)
    @hash[:title] = text
  end

  def description(text)
    @hash[:description] = text
  end

  def question(text)
    @hash[:questions] << { text: text }
  end

  def right(text)
    @hash[:answers] << { text: text, correct: true }
  end

  def wrong(text)
    @hash[:answers] << { text: text, correct: false }
  end

  def parse(filename)
    @hash = { :questions => [], :answers => [] }
    instance_eval(File.read(filename))
    { name: @name, properties: @hash }
  end

  # after parse has been done, this function returns a hash of all the user-visible strings
  def get_strings
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

    {"en" => { "data" => { "multi" => { @name => strings }}}}
  end

end

