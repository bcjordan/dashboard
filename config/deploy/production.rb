set :rails_env, 'production'
server 'dash1.code.org', :app, :web, :db, :primary => true
server 'dash2.code.org', :app, :web
server 'dash3.code.org', :app, :web
server 'dash4.code.org', :app, :web
