Given /^I am on "([^"]*)"$/ do |url|
  if ENV['TEST_DOMAIN']
    url = url.gsub(/\/\/[a-zA-Z0-9.\-]*\//, "//" + ENV['TEST_DOMAIN'] + "/")
  end
  @browser.navigate.to "#{url}"
end

When /^I wait to see "([.#])([^"]*)"$/ do |selector_symbol, name|
  selection_criteria = selector_symbol == '#' ? {:id => name} : {:class => name}
  wait = Selenium::WebDriver::Wait.new(:timeout => 60 * 2)
  wait.until { @browser.find_element(selection_criteria) }
end

Then /^I see "([.#])([^"]*)"$/ do |selector_symbol, name|
  selection_criteria = selector_symbol == '#' ? {:id => name} : {:class => name}
  @browser.find_element(selection_criteria)
end

When /^I wait until element "([^"]*)" has text "([^"]*)"$/ do |selector, text|
  wait = Selenium::WebDriver::Wait.new(:timeout => 60 * 2)
  wait.until { element_has_text(selector, text) }
end

Then /^check that I am on "([^"]*)"$/ do |url|
  if ENV['TEST_DOMAIN']
    url = url.gsub(/\/\/[a-zA-Z0-9.\-]*\//, "//" + ENV['TEST_DOMAIN'] + "/")
  end
  @browser.current_url.should eq url
end

When /^I fill in "([^"]*)" found by "([^"]*)" with "([^"]*)"$/ do |value, type, keys|
  @element = @browser.find_element(type, value)
  @element.send_keys keys
end

When /^I wait for (\d+) seconds?$/ do |seconds|
  sleep seconds.to_i
end

When /^I submit$/ do
  @element.submit
end

When /^I rotate to landscape$/ do
  if ENV['BS_AUTOMATE_OS'] == 'android'
    @browser.rotate(:landscape)
  end
end

When /^I inject simulation$/ do
  #@browser.execute_script('$("body").css( "background-color", "black")')
  @browser.execute_script("var fileref=document.createElement('script');  fileref.setAttribute('type','text/javascript'); fileref.setAttribute('src', '/assets/jquery.simulate.js'); document.getElementsByTagName('head')[0].appendChild(fileref)")
end

When /^I press "([^"]*)"$/ do |button|
  @button = @browser.find_element(:id, button)
  @button.click
end

When /^I press "([^"]*)" using jQuery$/ do |button|
  @browser.execute_script("$('#" + button + "').click()");
end

When /^I press a button with xpath "([^"]*)"$/ do |xpath|
  @button = @browser.find_element(:xpath, xpath)
  @button.click
end

When /^I click selector "([^"]*)"$/ do |jquery_selector|
  @browser.execute_script("$(\"#{jquery_selector}\").click();")
end

When /^I hold key "([^"]*)"$/ do |keyCode|
  script ="$(window).simulate('keydown',  {keyCode: $.simulate.keyCode['#{keyCode}']})"
  @browser.execute_script(script)
end

Then /^I should see title "([^"]*)"$/ do |title|
  @browser.title.should eq title
end

Then /^evaluate JavaScript expression "([^"]*)"$/ do |expression|
  @browser.execute_script("return #{expression}").should eq true
end

Then /^element "([^"]*)" has text "((?:[^"\\]|\\.)*)"$/ do |selector, expectedText|
  element_has_text(selector, expectedText)
end

Then /^element "([^"]*)" is visible$/ do |selector|
  visible = @browser.execute_script("return $('#{selector}').is(':visible')");
  visible.should eq true
end

Then /^element "([^"]*)" is hidden$/ do |selector|
  visible = @browser.execute_script("return $('#{selector}').is(':visible')");
  visible.should eq false
end

And /^output url$/ do
  puts @browser.current_url
end

Then /^there's an image "([^"]*)"$/ do |path|
  exists = @browser.execute_script("return $('img[src*=\"#{path}\"]').length != 0;")
  exists.should eq true
end

Then(/^"([^"]*)" should be in front of "([^"]*)"$/) do |selector_front, selector_behind|
  front_z_index = @browser.execute_script("return $('#{selector_front}').css('z-index')").to_i
  behind_z_index = @browser.execute_script("return $('#{selector_behind}').css('z-index')").to_i
  front_z_index.should be > behind_z_index
end

Then(/^I set slider speed to medium/) do
  @browser.execute_script("Turtle.speedSlider.setValue(0.8)");
end

Then(/^I slow down execution speed$/) do
  @browser.execute_script("Maze.scale.stepSpeed = 5;");
end
