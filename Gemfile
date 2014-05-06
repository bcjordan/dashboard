source 'https://rubygems.org'
ruby '2.0.0'

# Bundle edge Rails instead: gem 'rails', github: 'rails/rails'
gem 'rails', '4.0.3'
gem 'rails-i18n', '~> 4.0.0'

gem 'mysql2', '0.3.13'
gem 'seamless_database_pool'

gem 'le', '2.2.2'

group :development, :test do
  # Use debugger
  #gem 'debugger' unless ENV['RM_INFO']
  gem 'haml-rails' # haml (instead of erb) generators
  gem 'better_errors'
  gem 'binding_of_caller'
  gem 'ruby-prof'
  gem 'quiet_assets'

  # for unit testing
  gem 'factory_girl_rails'
  gem 'simplecov', require: false
  gem 'mocha', require: false
  gem "codeclimate-test-reporter", require: false
end

group :test do
  gem 'cucumber'
  gem 'selenium-webdriver'
  gem 'rspec'
  gem 'chromedriver-helper'
end

group :doc do
  # bundle exec rake doc:rails generates the API under doc/api.
  gem 'sdoc', require: false
end

# Use SCSS for stylesheets
gem 'sass-rails', '~> 4.0.0'

# Use Uglifier as compressor for JavaScript assets
gem 'uglifier', '>= 1.3.0'

# Use CoffeeScript for .js.coffee assets and views
gem 'coffee-rails', '~> 4.0.0'

# Use jquery as the JavaScript library
gem 'jquery-rails'

# Turbolinks makes following links in your web application faster. Read more: https://github.com/rails/turbolinks
# Removed since Blockly relies on standard the DomContentLoaded Event cycle, which turbolinks kills.
# gem 'turbolinks'

# Build JSON APIs with ease. Read more: https://github.com/rails/jbuilder
gem 'jbuilder', '~> 1.2'

# Use ActiveModel has_secure_password
# gem 'bcrypt-ruby', '~> 3.0.0'

# Use unicorn as the app server
gem 'unicorn'

# authentication and permissions
gem 'devise'
gem 'cancan'

gem 'omniauth-twitter'
gem 'omniauth-facebook'
gem 'omniauth-google-oauth2'
gem 'omniauth-windowslive'

gem 'bootstrap-sass', '~> 2.3.2.2'
gem 'haml'

gem 'execjs'
gem 'therubyracer', :platforms => :ruby

gem 'jquery-ui-rails'

gem 'nokogiri'

gem 'honeybadger'

gem 'redcarpet'

gem 'newrelic_rpm'

gem 'geocoder'

gem 'rmagick'

gem 'acts_as_list'

gem 'kaminari' # pagination

gem 'remotipart' # Ajax file upload
gem 'stringex', '~> 2.5.2' # Provides String.to_ascii