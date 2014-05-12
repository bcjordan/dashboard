# -*- coding: utf-8 -*-
require 'test_helper'

class SessionsControllerTest < ActionController::TestCase
  include Devise::TestHelpers

  test 'login error derives locale from cookie' do
    locale = 'es-ES'
    @request.cookies[:language_] = locale
    @request.env['devise.mapping'] = Devise.mappings[:user]
    post :create
    assert_select '#alert', I18n.t('devise.failure.not_found_in_database', :locale => locale)
  end

end
