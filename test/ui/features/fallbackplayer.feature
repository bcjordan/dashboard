Feature: The video fallback player works as expected

Background:
  Given I am on "http://learn.code.org/flappy/1?force_youtube_fallback"

Scenario: Load the page
  When I rotate to landscape
  Then I see ".video-js"
