class Section < ActiveRecord::Base
  belongs_to :user

  has_many :followers, dependent: :nullify do
    # extend this association to default the follower user to the
    # section owner
    def create(attrs, &block)
      if attrs[:user].blank? && attrs[:user_id].blank?
        attrs[:user_id] = proxy_association.owner.user_id
      end
      super
    end
 
    def build(attrs={}, &block)
      if attrs[:user].blank? && attrs[:user_id].blank?
        attrs[:user_id] = proxy_association.owner.user_id
      end
      super
    end
  end
  
  has_many :students, through: :followers, source: :student_user
  accepts_nested_attributes_for :students

  validates :name, uniqueness: { scope: :user_id }
  validates :name, presence: true

  before_create :assign_code

  def assign_code
    self.code = random_code
  end

  def students_attributes=
    
  end

  private
  CHARS = ("A".."Z").to_a
  def random_text(len)
    len.times.to_a.collect{ CHARS.sample }.join
  end

  def random_code
    loop do 
      code = random_text(6)
      return code unless Section.exists?(code: code)
    end 
  end
end
