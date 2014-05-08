# Distinguish between rake-test and test-server through RAKE_TEST environment variable.
# ENV['RAKE_TEST'] = '1' is also set in test_helper.rb (for direct non-rake ruby invocation of individual test files)
ENV['RAKE_TEST'] ||= '1' if defined?(Rake) && Rake.application.top_level_tasks.include?('test')

# Load extra translation yml for tests
I18n.load_path += Dir[Rails.root.join('test', 'en.yml')] if ENV['RAKE_TEST']
