#!/usr/bin/env ruby

require 'json'
require 'yaml'
require 'optparse'
require 'ostruct'

$options = OpenStruct.new
$options.browser = nil
$options.os_version = nil
$options.browser_version = nil
$options.feature = nil
$options.domain = nil
$options.tunnel = nil
$options.local = nil
$options.html = nil
$options.maximize = nil

# start supporting some basic command line filtering of which browsers we run against
opt_parser = OptionParser.new do |opts|
  opts.banner = "Usage: runner.rb [options] \
    Example: runner.rb -b chrome -o 7 -v 31 -f features/sharepage.feature \
    Example: runner.rb -d localhost:3000 -t \
    Example: runner.rb -l \
    Example: runner.rb -r"
  opts.separator ""
  opts.separator "Specific options:"
  opts.on("-b", "--browser BrowserName", String, "Specify a browser") do |b|
    $options.browser = b
  end
  opts.on("-o", "--os_version OS Version", String, "Specify an os version") do |os|
    $options.os_version = os
  end
  opts.on("-v", "--browser_version Browser Version", String, "Specify a browser version") do |bv|
    $options.browser_version = bv
  end
  opts.on("-f", "--feature Feature", String, "Single feature to run") do |f|
    $options.feature = f
  end
  opts.on("-d", "--domain Domain", String, "Specify an override domain, e.g. localhost:3000") do |d|
    $options.domain = d
  end
  opts.on("-r", "--real_mobile_browser", "Use real mobile browser, not emulator") do
    $options.realmobile = 'true'
  end
  opts.on("-t", "--tunnel", "Tunnel to local machine") do
    $options.tunnel = 'true'
  end
  opts.on("-l", "--local", "Use local webdriver, not BrowserStack") do
    $options.local = 'true'
  end
  opts.on("-m", "--maximize", "Maximize local webdriver window on startup") do
    $options.maximize = true
  end
  opts.on("--html", "Use html reporter") do
    $options.html = true
  end
  opts.on("-V", "--verbose", "Verbose") do
    $options.verbose = true
  end
  opts.on_tail("-h", "--help", "Show this message") do
    puts opts
    exit
  end
end

opt_parser.parse!(ARGV)

browsers = JSON.load(open("browsers.json"))

suiteStartTime = Time.now
suiteSuccessCount = 0
suiteFailCount = 0

# todo - make sure we do something to make it clear when there are unmatched
# steps in a feature
if $options.local
  browsers = [{:browser => "local"}]
end

$logfile = File.open("success.log", "w")
$errfile = File.open("error.log", "w")
$errbrowserfile = File.open("errorbrowsers.log", "w")

def log_success(msg)
  $logfile.puts msg
  puts msg if $options.verbose
end

def log_error(msg)
  $errfile.puts msg
  puts msg if $options.verbose
end

def log_browser_error(msg)
  $errbrowserfile.puts msg
  puts msg if $options.verbose
end


browsers.each do |browser|
  if $options.browser and browser['browser'] and $options.browser.casecmp(browser['browser']) != 0
    next
  end
  if $options.os_version and browser['os_version'] and $options.os_version.casecmp(browser['os_version']) != 0
    next
  end
  if $options.browser_version and browser['browser_version'] and $options.browser_version.casecmp(browser['browser_version']) != 0
    next
  end
  testStartTime = Time.now
  puts "Running with: #{browser["description"] ? browser["description"] : browser.inspect}"

  ENV['SELENIUM_BROWSER'] = browser['browser']
  ENV['SELENIUM_VERSION'] = browser['browser_version']
  ENV['BS_AUTOMATE_OS'] = browser['os']
  ENV['BS_AUTOMATE_OS_VERSION'] = browser['os_version']
  ENV['BS_ORIENTATION'] = browser['deviceOrientation']
  ENV['BS_ROTATABLE'] = browser['rotatable'] ? "true" : "false"
  ENV['TEST_DOMAIN'] = $options.domain if $options.domain
  ENV['TEST_TUNNEL'] = $options.tunnel ? "true" : "false"
  ENV['TEST_LOCAL'] = $options.local ? "true" : "false"
  ENV['MAXIMIZE_LOCAL'] = $options.maximize ? "true" : "false"
  ENV['TEST_REALMOBILE'] = ($options.realmobile && browser['mobile'] && browser['realMobile'] != false) ? "true" : "false"
  arguments = '';

  arguments += "#{$options.feature}" if $options.feature
  arguments += " -t ~@no_mobile" if browser['mobile']
  arguments += " -S" # strict mode, so that we fail on undefined steps
  arguments += " -f html -o output.html" if $options.html

  puts "  Running: cucumber #{arguments}"

  returnValue = `cucumber #{arguments}`
  succeeded = $?.exitstatus == 0

  if not succeeded
    log_error Time.now
    log_error browser.to_yaml
    log_error returnValue
    log_browser_error browser.to_yaml
  else
    log_success Time.now
    log_success browser.to_yaml
    log_success returnValue
  end

  suiteSuccessCount += 1 unless not succeeded
  suiteFailCount += 1 if not succeeded
  suiteResultString = succeeded ? "succeeded" : "failed"
  testDuration = Time.now - testStartTime

  puts "  Result: " + suiteResultString + ".  Duration: " + testDuration.round(2).to_s + " seconds"
end

$logfile.close
$errfile.close
$errbrowserfile.close

suiteDuration = Time.now - suiteStartTime
averageTestDuration = suiteDuration / (suiteSuccessCount + suiteFailCount)

puts suiteSuccessCount.to_s + " succeeded.  " + suiteFailCount.to_s +
  " failed.  Test count: " + (suiteSuccessCount + suiteFailCount).to_s +
  ".  Total duration: " + suiteDuration.round(2).to_s +
  " seconds.  Average test duration: " + averageTestDuration.round(2).to_s + " seconds."

exit suiteFailCount
