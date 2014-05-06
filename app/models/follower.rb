# Join table defining student-teacher relationships for Users
# (student_user is the student, user is the teacher)
class Follower < ActiveRecord::Base
  belongs_to :user
  belongs_to :student_user, foreign_key: "student_user_id", class_name: User
  belongs_to :section
end
