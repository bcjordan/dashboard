Feature: Complete a maze level

Background:
  Given I am on "http://learn.code.org/reset_session"
  Given I am on "http://learn.code.org/s/1/level/16?noautoplay=true"
  And I rotate to landscape
  And I wait for 2 seconds
  Then element ".dialog-title" has text "Puzzle 15 of 20"
  And element ".modal-content p:nth-child(2)" has text "Ok, this is just like the last puzzle, but you need to remember how you used the \"if\" block and the \"repeat\" block together."

Scenario: Submit an invalid solution
  When I press "x-close"
  Then element "#runButton" is visible
  And element "#resetButton" is hidden
  And I press "runButton"
  Then element "#runButton" is hidden
  And element "#resetButton" is visible
  Then I wait for 5 seconds
  And element ".congrats" is visible
  And element ".congrats" has text "You need an \"if\" block inside a \"repeat\" block. If you're having trouble, try the previous level again to see how it worked."
  # todo (brent): could also try the back button, and validate that clicking outside of the dialog closes it
  Then I press "again-button"
  And I press "resetButton"
  Then element "#runButton" is visible
  And element "#resetButton" is hidden

Scenario: Submit a valid solution
  When I press "x-close"
  Then element "#runButton" is visible
  And element "#resetButton" is hidden
  Then I drag block "4" to offset "220, -100"
  And I drag block "1" to block "6" plus offset 35, 50
  Then block "7" is child of block "6"
  Then I drag block "5" to block "7"
  And block "8" is child of block "7"
  Then I drag block "3" to block "8" plus offset 35, 30
  And block "9" is child of block "8"
  Then I press "runButton"
  And I wait for 20 seconds
  Then element ".congrats" is visible
  And element ".congrats" has text "Congratulations! You completed Puzzle 15."

  # todo (brent) : could test show code
  And I press "continue-button"
  And I wait for 2 seconds
  Then check that I am on "http://learn.code.org/s/1/level/17"
  Then check that level 16 on this stage is done
  Then check that level 15 on this stage is not done
