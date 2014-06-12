require 'test_helper'

class OmniauthCallbacksControllerTest < ActionController::TestCase
  # test "the truth" do
  #   assert true
  # end

  test "authorizing with known facebook account signs in" do
    user = create(:user, provider: 'facebook', uid: '1111')

    @request.env["devise.mapping"] = Devise.mappings[:user]
    @request.env['omniauth.auth'] = {provider: 'facebook', uid: '1111'}
    @request.env['omniauth.params'] = {}

    get :facebook

    assert_equal user.id, session['warden.user.user.key'].first.first
  end

  test "authorizing with unknown facebook acccount redirects to sign up" do
    @request.env["devise.mapping"] = Devise.mappings[:user]

    auth = stub('auth',
                slice: {provider: 'facebook', uid: '1111'},
                uid: '1111',
                provider: 'facebook',
                info: mock('info', nickname: '', name: 'someone', email: 'emailfromfacebook@whatev.xx'))
    @request.env['omniauth.auth'] = auth
    @request.env['omniauth.params'] = {}

    get :facebook
    assert_redirected_to '/users/sign_up'
  end

  # This is more like how it should work
  # test "authorizing with unknown facebook account creates new user" do
  #   @request.env["devise.mapping"] = Devise.mappings[:user]

  #   auth = stub('auth',
  #               slice: {provider: 'facebook', uid: '1111'},
  #               uid: '1111',
  #               provider: 'facebook',
  #               info: mock('info', nickname: '', name: 'someone', email: 'emailfromfacebook@whatev.xx'))
  #   @request.env['omniauth.auth'] = auth
  #   @request.env['omniauth.params'] = {}

  #   assert_creates(User) do
  #     get :facebook
  #   end

  #   new_user_id = session['warden.user.user.key'].first.first
  #   new_user = User.find(new_user_id)
  #   assert_equal 'facebook', new_user.provider
  #   assert_equal 'emailfromfacebook@whatev.xx', new_user.email
  #   assert_equal '1111', new_user.uid
  # end
end
