class Block < ActiveRecord::Base

  def apps
    # Blocks with no app are assumed to be for all apps.
    self.app.nil?? 'all' : self.app.split('|')
  end

  def self.xml blocks, toolbox=true
    xml = toolbox ? '<xml id="toolbox" style="display: none;">' : '<xml>'
    blocks.each do |block|
      xml << block.xml
    end
    xml << '</xml>'
  end
end