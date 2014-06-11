# -*- coding: utf-8 -*-

require 'test_helper'

class UserTest < ActiveSupport::TestCase
  setup do
    @good_data = { email: 'foo@bar.com', password: 'foosbars', username: 'user.12-34', name: 'tester', user_type: User::TYPE_STUDENT}
  end

  test "log in with password with pepper" do
    assert Devise.pepper

    user = User.create! @good_data

    # if password is already peppered we don't need to change the hashed pw
    assert_no_change('user.reload.encrypted_password') do
      assert user.valid_password?("foosbars")
      assert !user.valid_password?("foosbarsasdasds")
    end
  end

  test "logging in with password created without pepper saves new password" do
    a_pepper = "x" * 30

    Devise.stubs(:pepper).returns(nil)

    # create the user without the pepper
    user = User.create! @good_data
    
    Devise.stubs(:pepper).returns(a_pepper)

    # update pw with new hashed pw
    assert_change('user.reload.encrypted_password') do
      assert user.valid_password?("foosbars")
      assert !user.valid_password?("foosbarsasdasds")
    end

    # doesn't change second time
    assert_no_change('user.reload.encrypted_password') do
      assert user.valid_password?("foosbars")
      assert !user.valid_password?("foosbarsasdasds")
    end
  end
  
  test "cannot create user with invalid email" do
    user = User.create(@good_data.merge({email: 'foo@bar'}))
    assert user.errors.messages.length == 1
  end
  
  test "cannot create user with short username" do
    user = User.create(@good_data.merge({username: 'tiny'}))
    assert user.errors.messages.length == 1
  end

  test "cannot create user with long username" do
    user = User.create(@good_data.merge({username: 'superreallydoublelongusername'}))
    assert user.errors.messages.length == 1
  end

  test "cannot create user with no type" do
    user = User.create(@good_data.merge(user_type: nil))
    assert user.errors.messages.length == 1
  end

  test "cannot create user with invalid type" do
    user = User.create(@good_data.merge(user_type: 'xxxxx'))
    assert user.errors.messages.length == 1
  end

  test "cannot create user with username with whitespace" do
    user = User.create(@good_data.merge({username: 'bo gus'}))
    assert user.errors.messages.length == 1
  end
    
  test "cannot create user with username with duplicate email" do
    # actually create a user
    user = User.create(@good_data)
    #puts user.errors.messages.inspect
    assert user.valid?

    user = User.create(@good_data.merge({email: 'FOO@bar.com', username: 'user.12-35'}))
    assert user.errors.messages.length == 1, "Email should be rejected as a dup"
  end
  
  test "cannot create user with username with duplicate username" do
    # actually create a user
    user = User.create(@good_data)
    #puts user.errors.messages.inspect
    assert user.valid?

    user = User.create(@good_data.merge({email: 'OTHER@bar.com', username: 'USER.12-34'}))
    assert user.errors.messages.length == 1, "username should be rejected as a dup"
  end

  test "can create a user with age" do
    Timecop.travel Time.local(2013, 9, 1, 12, 0, 0) do
      assert_difference('User.count') do
        user = User.create(@good_data.merge({age: '7', username: 'anewone', email: 'new@email.com'}))
      
        assert_equal Date.new(Date.today.year - 7, Date.today.month, Date.today.day), user.birthday
        assert_equal 7, user.age
      end
    end
  end


  test "trying to create a user with age that's not a number creates user without a birthday" do
    assert_difference('User.count') do
      user = User.create(@good_data.merge({age: 'old', username: 'anewone', email: 'new@email.com'}))
      assert_equal nil, user.birthday
      assert_equal nil, user.age
    end
  end

  test "trying to create a user with negative age creates user without a birthday" do
    assert_difference('User.count') do
      user = User.create(@good_data.merge({age: -15, username: 'anewone', email: 'new@email.com'}))
      assert_equal nil, user.birthday
      assert_equal nil, user.age
    end
  end

  test "can update a user with age" do
    Timecop.travel Time.local(2013, 9, 1, 12, 0, 0) do
      user = User.create(@good_data.merge({age: '7', username: 'anewone', email: 'new@email.com'}))
      assert_equal 7, user.age

      user.update_attributes(age: '9')
      assert_equal Date.new(Date.today.year - 9, Date.today.month, Date.today.day), user.birthday
      assert_equal 9, user.age
    end
  end

  test "does not update birthday if age is the same" do
    user = User.create(@good_data.merge({age: '7', username: 'anewone', email: 'new@email.com'}))
    assert_equal 7, user.age
    
    Timecop.freeze(Date.today + 40) do
      assert_no_difference('user.reload.birthday') do
        user.update_attributes(age: '7')
      end
      assert_equal 7, user.age
    end
  end

  test "can create user without email" do
    assert_difference('User.count') do
      User.create!(username: 'student', user_type: 'student', name: 'Student without email', password: 'xxxxxxxx', provider: 'manual')
    end
  end

  test "cannot create teacher without email" do
    assert_no_difference('User.count') do
      User.create(username: 'badteacher', user_type: 'teacher', name: 'Bad Teacher', password: 'xxxxxxxx', provider: 'manual')
    end
  end

  test "cannot make an account without email a teacher" do
    user = User.create(username: 'student', user_type: 'student', name: 'Student without email', password: 'xxxxxxxx', provider: 'manual')

    user.user_type = 'teacher'
    assert !user.save
  end


  test "cannot make an account without email an admin" do
    user = User.create(username: 'student', user_type: 'student', name: 'Student without email', password: 'xxxxxxxx', provider: 'manual')

    user.admin = true
    assert !user.save
  end

  test "cannot create admin without email" do
    assert_no_difference('User.count') do
      User.create(username: 'badteacher', user_type: 'student', admin: true, name: 'Wannabe admin', password: 'xxxxxxxx', provider: 'manual')
    end
  end

  test "gallery" do
    user = create(:user)
    assert_equal [], user.gallery_activities

    create(:activity, user: user) # not saved to gallery
    assert_equal [], user.gallery_activities

    activity2 = create(:activity, user: user)
    ga2 = GalleryActivity.create!(activity: activity2, user: user)
    assert_equal [ga2], user.reload.gallery_activities

    create(:activity, user: user) # not saved to gallery
    assert_equal [ga2], user.reload.gallery_activities

    activity4 = create(:activity, user: user)
    ga4 = GalleryActivity.create!(activity: activity4, user: user)
    assert_equal [ga4, ga2], user.reload.gallery_activities
  end

  test "short name" do
    assert_equal 'Laurel', create(:user, :name => 'Laurel Fan', :username => 'laurelfan').short_name # first name last name
    assert_equal 'laurel', create(:user, :name => '   ', :username => 'laurel').short_name # 'no' name
    assert_equal 'Winnie', create(:user, :name => 'Winnie the Pooh').short_name # middle name
    assert_equal "D'Andre", create(:user, :name => "D'Andre Means").short_name # punctuation ok
    assert_equal '樊瑞', create(:user, :name => '樊瑞').short_name # ok, this isn't actually right but ok for now
    assert_equal 'Laurel', create(:user, :name => 'Laurel').short_name # just one name
    assert_equal 'some', create(:user, :name => '  some whitespace in front  ').short_name # whitespace in front
  end

  test "cannot call find_first_by_auth_conditions with nonsense" do
    # login by username still works
    user = create :user, username: 'blahblah'
    assert_equal user, User.find_first_by_auth_conditions(login: 'blahblah')

    # login by email still works
    email_user = create :user, username: 'blahblah2', email: 'not@an.email'
    assert_equal email_user, User.find_first_by_auth_conditions(login: 'not@an.email')

    # wat you can't do that hax0rs
    assert_equal nil, User.find_first_by_auth_conditions(email: {'$acunetix' => 1})
    # this used to raise a mysql error, now we sanitize it into a nonsense string
  end

end
