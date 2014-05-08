if ENV["CODECLIMATE_REPO_TOKEN"]
  require "codeclimate-test-reporter"
  CodeClimate::TestReporter.start
else
# there can be only one code coverage tool
  require 'simplecov'
  SimpleCov.start :rails
end

ENV["RAILS_ENV"] ||= "test"
ENV['RAKE_TEST'] ||= '1'

require File.expand_path('../../config/environment', __FILE__)
I18n.load_path += Dir[Rails.root.join('test', 'en.yml')]
I18n.backend.reload!

require 'rails/test_help'

require "mocha/test_unit"

class ActiveSupport::TestCase
  ActiveRecord::Migration.check_pending!

  # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
  #
  # Note: You'll currently still have to declare fixtures explicitly in integration tests
  # -- they do not yet inherit this setting
  fixtures :all

  # Add more helper methods to be used by all tests here...
  include FactoryGirl::Syntax::Methods

  def assert_creates(*args)
    assert_difference(args.collect(&:to_s).collect {|class_name| "#{class_name}.count"}) do
      yield
    end
  end

  def assert_does_not_create(*args)
    assert_no_difference(args.collect(&:to_s).collect {|class_name| "#{class_name}.count"}) do
      yield
    end
  end

end


# Helpers for all controller test cases
class ActionController::TestCase 
  include Devise::TestHelpers

  def assert_redirected_to_sign_in
    assert_response :redirect
    assert_redirected_to "http://test.host/users/sign_in"
  end


  def self.generate_admin_only_tests_for(action, params = {})
    test "should get #{action}" do
      get action, params
      assert_response :success
    end

    test "should not get #{action} if not signed in" do
      sign_out @admin
      get action, params
      assert_redirected_to_sign_in
    end

    test "should not get #{action} if not admin" do
      sign_in @not_admin
      get action, params
      assert_response :forbidden
    end
  end
end

