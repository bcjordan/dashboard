class Section < ActiveRecord::Base
  belongs_to :user

  has_many :followers, dependent: :nullify
  has_many :students, through: :followers, source: :student_user
  accepts_nested_attributes_for :students

  validates :name, uniqueness: { scope: :user_id }
  validates :name, presence: true

  before_create :assign_code

  def assign_code
    self.code = random_code
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
