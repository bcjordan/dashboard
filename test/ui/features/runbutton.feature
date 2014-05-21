Feature: Test Run / Reset button behavior

Background:
  Given I am on "http://learn.code.org/reset_session"
  Given I am on "http://learn.code.org/s/1/level/16?noautoplay=true"
  And I rotate to landscape
  And I wait for 2 seconds
  Then element ".dialog-title" has text "Puzzle 15 of 20"

Scenario: Pressing run/reset/run rapidly
  When I press "x-close"
  Then element "#runButton" is visible
  And element "#resetButton" is hidden
  And I press "runButton"
  And I press "resetButton"
  And I press "runButton"
  Then element ".congrats" is hidden
  And element "#runButton" is hidden
  And element "#resetButton" is visible
  Then I wait for 5 seconds
  And element ".congrats" is visible
