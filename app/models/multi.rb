require "csv"

class Multi < Level
  include Seeded
  # Fix STI routing http://stackoverflow.com/a/9463495
  def self.model_name
    Level.model_name
  end

  def self.setup(data)
    Multi.create name: data[:name], game_id: Game.find_by(name:"Multi").id, properties: data[:properties]
  end

end
