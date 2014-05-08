class ProcessDSL
  # returns 'xyz' from 'ProcessXYZ' subclasses
  def suffix()
    self.class.to_s.tap{|s|s.slice!("Process")}.downcase
  end

  def parse(object)
    instance_eval(object.is_a?(String) ?
      object : File.read(filename))
  end

  # after parse has been done, this function returns a hash of all the user-visible strings from this instance
  def i18n_hash()
  end

end
