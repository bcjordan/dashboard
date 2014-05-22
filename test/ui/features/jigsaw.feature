Feature: Visiting a jigsaw page

Scenario: Loading the first jigsaw level
  Given I am on "http://learn.code.org/s/k-1/stage/1/puzzle/1"
  And I rotate to landscape
  Then element ".dialog-title" has text "Puzzle 1 of 12"
  And I press "x-close"
  Then there's an image "jigsaw/blank.png"
