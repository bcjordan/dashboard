require 'test_helper'

class SectionTest < ActiveSupport::TestCase
  test "do not attempt to create sections with duplicate random codes" do
    teacher = create(:teacher)
    
    srand 1
    s1 = Section.create!(user: teacher, name: "section 1")

    # seed the RNG with the same thing so we get the same "random" numbers
    srand 1
    s2 = Section.create!(user: teacher, name: "section 2")

    assert_not_equal s1.code, s2.code

    assert s1.code =~ /^[A-Z]{6}$/
    assert s2.code =~ /^[A-Z]{6}$/

    # now do it again
    srand 1
    s3 = Section.create!(user: teacher, name: "section 3")
    assert_not_equal s1.code, s3.code
    assert_not_equal s2.code, s3.code

    assert s3.code =~ /^[A-Z]{6}$/
  end

  test "user must be teacher" do
    teacher = create(:teacher)
    student = create(:student_user)

    teacher_section = Section.create(user: teacher, name: "a section")
    assert teacher_section.persisted?

    student_section = Section.create(user: student, name: "a section")

    assert !student_section.persisted?
    assert_equal ["User must be a teacher"], student_section.errors.full_messages
  end
end
