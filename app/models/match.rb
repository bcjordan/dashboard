require "csv"

class Match < Level
  include Seeded
  # Fix STI routing http://stackoverflow.com/a/9463495
  def self.model_name
    Level.model_name
  end

  def self.setup(data)
    match = Match.find_or_create_by({ name: data[:name] })
    match.update!(name: data[:name], game_id: Game.find_by(name:"Match").id, properties: data[:properties])
  end

end
