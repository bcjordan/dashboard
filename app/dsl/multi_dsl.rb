class ProcessMulti < ProcessMatch
  def right(text) answer(text, true) end
  def wrong(text) answer(text, false) end
end
