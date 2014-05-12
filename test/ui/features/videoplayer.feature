Feature: The video fallback player works as expected

Background:
  Given I am on "http://learn.code.org/reset_session"

# TODO(bjordan): enable when we have a fallback again
#Scenario: Fallback player
#  Given I am on "http://learn.code.org/flappy/1?force_youtube_fallback"
#  When I rotate to landscape
#  Then I see ".video-js"

@no_mobile
Scenario: Normal player
  Given I am on "http://learn.code.org/flappy/1"
  When I rotate to landscape
  Then I see "#video"
  Then I see the first Flappy YouTube video with the correct parameters
