Feature: Step Mode

Scenario: Step Only - Failure
  Given I am on "http://localhost:3000/s/step/puzzle/1"
  Then element "#runButton" is hidden
  And element "#resetButton" is hidden
  And element "#stepButton" is visible
  Then I drag block "1" to block "4"
  Then I press "stepButton"
  And I wait for 3 seconds
  And element "#runButton" is hidden
  And element "#resetButton" is visible
  And element "#stepButton" is visible
  And block "4" has class "blocklySpotlight"
  And block "5" doesn't have class "blocklySpotlight"

  # After second press, second block is highlighted and step button goes away
  Then I press "stepButton"
  And I wait for 3 seconds
  And element "#runButton" is hidden
  And element "#resetButton" is visible
  And element "#stepButton" is hidden
  And block "4" doesn't have class "blocklySpotlight"
  And block "5" has class "blocklySpotlight"
  Then I wait to see "#x-close"
  And I press "x-close"
  And element "#runButton" is hidden
  And element "#resetButton" is visible
  And element "#stepButton" is hidden
  # Last block is still highlighted
  And block "4" doesn't have class "blocklySpotlight"
  And block "5" has class "blocklySpotlight"

  Then I press "resetButton"
  Then element "#runButton" is hidden
  And element "#resetButton" is hidden
  And element "#stepButton" is visible

Scenario: Step Only - Success
  Given I am on "http://localhost:3000/s/step/puzzle/1"
  Then element "#runButton" is hidden
  And element "#resetButton" is hidden
  And element "#stepButton" is visible
  Then I drag block "1" to block "4"
  Then I drag block "1" to block "5"
  Then I press "stepButton"
  And I wait for 3 seconds
  Then I press "stepButton"
  And I wait for 3 seconds
  Then I press "stepButton"
  And I wait for 3 seconds
  Then I wait to see "#x-close"
  And element ".congrats" has text "Congratulations! You completed Puzzle 1."

Scenario: Step Only - Reset while stepping
  Given I am on "http://localhost:3000/s/step/puzzle/1"
  Then element "#runButton" is hidden
  And element "#resetButton" is hidden
  And element "#stepButton" is visible
  Then I drag block "1" to block "4"
  Then I press "stepButton"
  And I wait for 3 seconds
  And element "#runButton" is hidden
  And element "#resetButton" is visible
  And element "#stepButton" is visible
  Then I press "resetButton"
  And element "#runButton" is hidden
  And element "#resetButton" is hidden
  And element "#stepButton" is visible


Scenario: Step and Run
  Given I am on "http://localhost:3000/s/step/puzzle/2"
  Then element "#runButton" is visible
  And element "#resetButton" is hidden
  And element "#stepButton" is visible
  Then I drag block "1" to block "4"
  Then I press "stepButton"
  And I wait for 3 seconds
  And block "4" has class "blocklySpotlight"
  And block "5" doesn't have class "blocklySpotlight"
  Then element "#runButton" is hidden
  And element "#resetButton" is visible
  And element "#stepButton" is visible
  And I press "resetButton"
  Then element "#runButton" is visible
  And element "#resetButton" is hidden
  And element "#stepButton" is visible
