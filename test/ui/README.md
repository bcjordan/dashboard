# Dashboard UI Tests

Automated UI tests for the dashboard.

## Setup

### On your machine: Chrome webdriver

This is the best option for rapid iteration while writing a new test. ChromeDriver will run your tests in a new window on your machine.

1. [Download the chromedriver](https://code.google.com/p/selenium/wiki/ChromeDriver)
2. Start the chromedriver `/path/to/your/downloaded/chromedriver`
3. `cd test-dashboard`
4. `bundle install`
5. `rbenv rehash`
6. `./runner.rb -l -m -d localhost:3000`
  - `-l` makes it use the chromedriver
  - `-m` maximizes the window on startup
  - `-d` sets the destination
  - a window will pop up in the background in which you can watch the tests happen
7. In a separate window, run `tail -f *.log` to watch the results of your tests
  - `-f` streams the log in your shell, so it will be updated as new lines are written

### With remote browsers: Browserstack

Running tests remotely on [Browserstack automate](http://browserstack.com/automate) lets you review results, view visual logs of test runs and even watch live video of your tests running on different browsers in real-time.

We are currently **limited to 2 concurrent test runs**, so you and one other person can be running your test suites at the same time. Browserstack shows how many tests are running at the top left. If it says 2/2, wait or ask for one to free up.

#### Credentials 

BrowserStack requires credentials to be set in the environment first.

Ideally, use your own credentials from https://www.browserstack.com/automate (click Ruby then expand your creds at the top left). This will show your username while the tests are running, so it's easier to see which tests are part of your current run.

```
export BROWSERSTACK_USERNAME='your username'
export BROWSERSTACK_AUTHKEY='your authkey'
```

Code.org shared credentials can be used by placing the dashboard directory directly within the `website-ci` repository.

#### Testing your local site copy: Browserstack tunnel

1. Download the [command line Browserstack client](http://www.browserstack.com/local-testing#command-line)
2. `/path/to/your/downloaded/BrowserStackLocal $BROWSERSTACK_AUTHKEY localhost,3000,0`
3. `./runner.rb -d localhost:3000 -t`

You can now watch your tests run at the [Browserstack automate page](https://www.browserstack.com/automate).

## Options

Here are some example command line options.  Run `./runner.rb --help` for a full list.

Run with a specific OS version, browser, browser version, and feature:

```
./runner.rb -o 7 -b chrome -v 31 -f features/simpledrag.feature

OR

./runner.rb -c Chrome31Win7 -f features/simpledrag.feature
```

Run with a specific domain substituted in place of the default, tunneling from BrowserStack into local machine:

```
./runner.rb -d localhost:3000 -t
```

Note that tunneling to local machine from BrowserStack requires the tool at http://www.browserstack.com/local-testing#command-line.

Run against local Chrome webdriver instead of BrowserStack:

```
./runner.rb -l
```

Note that this requires a local webdriver running on port 9515, such as Chromedriver at http://chromedriver.storage.googleapis.com/index.html.

Run using real mobile browsers, not emulators, using BrowserStack's beta feature:

```
./runner.rb -r
```
