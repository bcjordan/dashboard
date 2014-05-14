Dashboard::Application.routes.draw do
  resources :gallery_activities, path: '/gallery'
  resources :teacher_bonus_prizes
  resources :teacher_prizes
  resources :prizes
  resources :callouts
  resources :videos
  resources :concepts
  resources :activities
  resources :sections, only: [:new, :create, :edit, :update, :destroy]
  resources :level_sources, path: '/sh/', only: [:show, :edit] do
    member do
      get 'generate_image'
      get 'original_image'
    end
  end
  get '/share/:id', to: redirect('/sh/%{id}')

  resources :level_source_hints
  get '/add_hint/:level_source_id', :to => 'level_source_hints#add_hint', as: 'add_hint'
  get '/show_hints/:level_source_id', :to => 'level_source_hints#show_hints', as: 'show_hints'
  get '/add_pop_hint/:idx', :to => 'level_source_hints#add_pop_hint', as: 'add_pop_hint'
  get '/show_pop_hints/:idx', :to => 'level_source_hints#show_pop_hints', as: 'show_pop_hints'
  get '/add_pop_hint_per_level/:level_id/:idx', :to => 'level_source_hints#add_pop_hint_per_level', as: 'add_pop_hint_per_level'
  get '/show_pop_hints_per_level/:level_id/:idx', :to => 'level_source_hints#show_pop_hints_per_level', as: 'show_pop_hints_per_level'
  get '/add_hint_access', :to => 'level_source_hints#add_hint_access', as: 'add_hint_access'

  resources :frequent_unsuccessful_level_sources, only: [:index]

  devise_for :users, controllers: {
    omniauth_callbacks: 'omniauth_callbacks',
    registrations: 'registrations',
    confirmations: 'confirmations',
    sessions: 'sessions'
  }

  post '/signup_check/username', to: 'home#check_username'

  root :to => "home#index"
  get '/home_insert', to: 'home#home_insert'
  get '/health_check', to: 'home#health_check'
  get '/admin/debug', to: 'home#debug'

  post '/locale', to: 'home#set_locale', as: 'locale'

  resources :games do
    resources :levels do
      get 'edit_blocks/:type', to: 'levels#edit_blocks', as: 'edit_blocks'
      post 'update_blocks/:type', to: 'levels#update_blocks', as: 'update_blocks'
    end
  end

  get 'builder', to: 'levels#builder'
  post 'upload_maze_level', to: 'levels#upload_maze_level'
  post 'create_custom', to: 'levels#create_custom'
  get 'levels/new', to: 'levels#new'

  resources :scripts, path: '/s/' do
    post 'sort', to: 'scripts#sort'

    # /s/xxx/level/yyy
    resources :script_levels, as: :levels, only: [:show], path: "/level", format: false do
      get 'solution', to: 'script_levels#solution'
    end

    # /s/xxx/puzzle/yyy
    get 'puzzle/:chapter', to: 'script_levels#show', as: 'puzzle', format: false

    # /s/xxx/puzzle/stage/yyy/puzzle/zzz
    resources :stages, only: [:show], path: "/stage", format: false do
      resources :script_levels, only: [:show], path: "/puzzle", format: false do
      end
    end
  end

  get 'reset_session', to: 'application#reset_session_endpoint'

  # duplicate routes are for testing -- ActionController::TestCase calls to_s on all params
  get '/hoc/reset', to: 'script_levels#show', script_id: Script::HOC_ID, reset:true, as: 'hoc_reset'
  get '/hoc/reset', to: 'script_levels#show', script_id: Script::HOC_ID.to_s, reset:true
  get '/hoc/:chapter', to: 'script_levels#show', script_id: Script::HOC_ID, as: 'hoc_chapter', format: false
  get '/hoc/:chapter', to: 'script_levels#show', script_id: Script::HOC_ID.to_s, format: false

  get '/k8intro/:chapter', to: 'script_levels#show', script_id: Script::TWENTY_HOUR_ID, as: 'k8intro_chapter', format: false
  get '/k8intro/:chapter', to: 'script_levels#show', script_id: Script::TWENTY_HOUR_ID.to_s, format: false
  get '/editcode/:chapter', to: 'script_levels#show', script_id: Script::EDIT_CODE_ID, as: 'editcode_chapter', format: false
  get '/editcode/:chapter', to: 'script_levels#show', script_id: Script::EDIT_CODE_ID.to_s, format: false
  get '/2014/:chapter', to: 'script_levels#show', script_id: Script::TWENTY_FOURTEEN_LEVELS_ID, as: 'twenty_fourteen_chapter', format: false
  get '/2014/:chapter', to: 'script_levels#show', script_id: Script::TWENTY_FOURTEEN_LEVELS_ID.to_s, format: false
  get '/builder/:chapter', to: 'script_levels#show', script_id: Script::BUILDER_ID, as: 'builder_chapter', format: false
  get '/builder/:chapter', to: 'script_levels#show', script_id: Script::BUILDER_ID.to_s, format: false
  get '/flappy/:chapter', to: 'script_levels#show', script_id: Script::FLAPPY_ID, as: 'flappy_chapter', format: false
  get '/flappy/:chapter', to: 'script_levels#show', script_id: Script::FLAPPY_ID.to_s, format: false
  get '/jigsaw/:chapter', to: 'script_levels#show', script_id: Script::JIGSAW_ID, as: 'jigsaw_chapter', format: false
  get '/jigsaw/:chapter', to: 'script_levels#show', script_id: Script::JIGSAW_ID.to_s, format: false


  resources :prize_providers
  get '/prize_providers/:id/claim_prize', to: 'prize_providers#claim_prize', as: 'prize_provider_claim_prize'

  resources :followers, only: [:create, :index]
  get '/followers/:teacher_user_id/accept', to: 'followers#accept', as: 'follower_accept'
  post '/followers/create_student', to: 'followers#create_student', as: 'create_student'
  get '/followers/manage', to: 'followers#manage', as: 'manage_followers'
  get '/followers/sections', to: 'followers#sections', as: 'sections_followers'

  # change student password
  get '/followers/change_password/:user_id', to: 'followers#student_edit_password', as: 'student_edit_password'
  post '/followers/save_password', to: 'followers#student_update_password', as: 'student_update_password'

  post '/followers/add_to_section', to: 'followers#add_to_section', as: 'add_to_section'
  post '/followers/remove_from_section', to: 'followers#remove_from_section', as: 'remove_from_section'
  post '/followers/remove', to: 'followers#remove', as: 'remove_follower'
  get '/join(/:section_code)', to: 'followers#student_user_new', as: 'student_user_new'
  post '/join/:section_code', to: 'followers#student_register', as: 'student_register'

  post '/milestone/:user_id/:script_level_id', :to => 'activities#milestone', :as => 'milestone'

  get '/admin/usage', to: 'reports#all_usage', as: 'all_usage'
  get '/admin/stats', to: 'reports#admin_stats', as: 'admin_stats'
  get '/admin/progress', to: 'reports#admin_progress', as: 'admin_progress'
  get '/admin/gallery', to: 'reports#admin_gallery', as: 'admin_gallery'
  get '/admin/assume_identity', to: 'reports#assume_identity_form', as: 'assume_identity_form'
  post '/admin/assume_identity', to: 'reports#assume_identity', as: 'assume_identity'
  get '/stats/usage/:user_id', to: 'reports#usage', as: 'usage'
  get '/stats/students', to: 'reports#students', as: 'student_usage'
  get '/stats/:user_id', to: 'reports#user_stats', as: 'user_stats'
  get '/stats/level/:level_id', to: 'reports#level_stats', as: 'level_stats'
  get '/popup/stats', to: 'reports#header_stats', as: 'header_stats'
  get '/redeemprizes', to: 'reports#prizes', as: 'my_prizes'

  get '/notes/:key', to: 'notes#index'

  get '/api/user_menu', to: 'api#user_menu', as: 'user_menu'
  get '/api/user_hero', to: 'api#user_hero', as: 'user_hero'

  # The priority is based upon order of creation: first created -> highest priority.
  # See how all your routes lay out with "rake routes".

  # You can have the root of your site routed with "root"
  # root 'welcome#index'

  # Example of regular route:
  #   get 'products/:id' => 'catalog#view'

  # Example of named route that can be invoked with purchase_url(id: product.id)
  #   get 'products/:id/purchase' => 'catalog#purchase', as: :purchase

  # Example resource route (maps HTTP verbs to controller actions automatically):
  #   resources :products

  # Example resource route with options:
  #   resources :products do
  #     member do
  #       get 'short'
  #       post 'toggle'
  #     end
  #
  #     collection do
  #       get 'sold'
  #     end
  #   end

  # Example resource route with sub-resources:
  #   resources :products do
  #     resources :comments, :sales
  #     resource :seller
  #   end

  # Example resource route with more complex sub-resources:
  #   resources :products do
  #     resources :comments
  #     resources :sales do
  #       get 'recent', on: :collection
  #     end
  #   end

  # Example resource route with concerns:
  #   concern :toggleable do
  #     post 'toggle'
  #   end
  #   resources :posts, concerns: :toggleable
  #   resources :photos, concerns: :toggleable

  # Example resource route within a namespace:
  #   namespace :admin do
  #     # Directs /admin/products/* to Admin::ProductsController
  #     # (app/controllers/admin/products_controller.rb)
  #     resources :products
  #   end
end
