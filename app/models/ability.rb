class Ability
  include CanCan::Ability

  def initialize(user)
    # Define abilities for the passed in user here. For example:
    #
    user ||= User.new # guest user (not logged in)
    if user.admin?
      can :manage, :all
    else
      can :read, :all
      cannot :read, [PrizeProvider, Prize, TeacherPrize, TeacherBonusPrize, LevelSourceHint, FrequentUnsuccessfulLevelSource, :reports, User]
      can :claim_prize, PrizeProvider
    end

    if user.id
      can :manage, user

      # TODO a bunch of these should probably be limited by user_id
      can :manage, Section, user_id: user.id # TODO limit this to teachers
      can :create, Activity
      can :save_to_gallery, Activity, user_id: user.id
      can :create, GalleryActivity, user_id: user.id
      can :destroy, GalleryActivity, user_id: user.id
      can :create, UserLevel
      can :create, Follower
    end
    if user.hint_access? || user.teacher?
      can :manage, [LevelSourceHint, FrequentUnsuccessfulLevelSource]
    end

    if user.teacher? || !user.students.empty? # remove second when we fix users so all teachers are teachers
      can :manage, :teacher
      can :manage, user.students
    end
    #
    # The first argument to `can` is the action you are giving the user 
    # permission to do.
    # If you pass :manage it will apply to every action. Other common actions
    # here are :read, :create, :update and :destroy.
    #
    # The second argument is the resource the user can perform the action on. 
    # If you pass :all it will apply to every resource. Otherwise pass a Ruby
    # class of the resource.
    #
    # The third argument is an optional hash of conditions to further filter the
    # objects.
    # For example, here the user can only update published articles.
    #
    #   can :update, Article, :published => true
    #
    # See the wiki for details:
    # https://github.com/ryanb/cancan/wiki/Defining-Abilities
  end
end
