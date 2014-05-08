class Base
  def name(text)
    @name = text
  end

  def title(text)
    @hash[:title] = text
  end

  def description(text)
    @hash[:description] = text
  end
end
