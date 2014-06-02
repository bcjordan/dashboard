Feature: Visiting a studio page

Scenario: Using a studio dropdown
  Given I am on "http://learn.code.org/s/k-1/stage/8/puzzle/2"
  And I rotate to landscape
  And I press "x-close"
  Then there's an SVG image "studio/dog_thumb.png"
  Then there's not an SVG image "studio/cat_thumb.png"
  And I press the image dropdown
  Then there's a div with a background image "studio/cat_thumb.png"
  Then there's a div with a background image "studio/dog_thumb.png"
