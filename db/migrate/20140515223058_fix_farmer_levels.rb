class FixFarmerLevels < ActiveRecord::Migration
  def self.up
    Karel.all.each do |level|
      maze = level.properties["maze"]
      dirt = level.properties["initial_dirt"]
      maze.each_with_index do |row, y|
        row.each_with_index do |_, x|
          maze[y][x] = 1 if dirt[y][x] != 0 && maze[y][x] == 0
          dirt[y][x] -= 100 if dirt[y][x] > 50
        end
      end
      level.save
    end
  end
end
