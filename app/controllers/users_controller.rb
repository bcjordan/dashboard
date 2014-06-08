class UsersController < ApplicationController
  before_filter :authenticate_user!
  check_authorization 
  load_and_authorize_resource 

  def show
    
  end
end
