module SerializedProperties
  extend ActiveSupport::Concern
  included do
    serialize :properties, JSON
    class_attribute :serialized_properties
    self.serialized_properties ||= []

    after_initialize :init_properties
    before_save { properties.reject! { |k, v| v.nil? } }
  end

  def assign_attributes(new_attributes)
    init_properties
    super(new_attributes)
  end

  module ClassMethods
    def serialized_attrs(*args)
      self.serialized_properties.concat args
    end

    def initialize_attributes(attributes, options = {})
      serialized_properties.each do |property|
        define_method(property) { read_attribute('properties')[property.to_s]}
        define_method("#{property}=") { |value| read_attribute('properties')[property.to_s] = value }
      end
      super(attributes, options)
    end
  end

  private
  def init_properties
    write_attribute('properties', {}) unless read_attribute('properties')
  end

end
