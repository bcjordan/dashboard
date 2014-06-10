# Dashboard: [learn.code.org](http://learn.code.org)

<img src="http://i.imgur.com/b8UllKd.png" width=400/>

## Background

We are building drag-drop programming tutorials to allow a beginner to learn very basic programming concepts (sequencing, if-then statements, for loops, variables, functions), but using drag-drop programming.
The visual language we're using is based on Blockly (and open-source drag-drop language that spits out XML or JavaScript or Python).

The end-product is a 1-hour tutorial to be used during the Hour of Code campaign, for anybody to get a basic intro to Computer Science, AND a 20-hour follow-on tutorial and teacher-dashboard, meant for use in K-8 (elementary and middle school) classrooms.

For the 1-hour tutorial, we'd like to localize for international use (although we aren't going to get to bi-di support anytime soon). For the 20-hour curriculum, we'd like to have international support too, eventually.
The 1-hour tutorial should work on any browser (including tablets, smartphones), and require no sign-in. The 20-hour tutorial is optimized for desktops and tablets, and requires a login to save state.

Our code is segmented into three parts, each a separate git repository:

1. [blockly-core](https://github.com/code-dot-org/blockly-core): **Blockly Core** is the visual programming language platform used for the interactive tutorials.
2. [blockly](https://github.com/code-dot-org/blockly): **Blockly** includes *apps*—blockly puzzles built based on Blockly Core. It includes all of the apps used in the dashboard's 1-Hour and a 20-Hour curricula.
3. [dashboard](https://github.com/code-dot-org/dashboard): **Dashboard** (this repository), is the tutorial platform which organizes blockly levels into tutorials, and includes support for teachers to track student progress.

## Setting up for development

### (optional) Setting up Blockly

If you'll be making modifications to blockly code, you can set that up first. First, checkout and build [blockly](https://github.com/code-dot-org/blockly) as a sibling directory to `dashboard`. See its [README](https://github.com/code-dot-org/blockly) for setup instructions.

Once that is done, continue following these instructions and we'll symlink your dev version of blockly along the way.

If you won't be making modifications to blockly code, you can just skip the symlink step and the dashboard will use a pre-built version of blockly.

### Setting up Dashboard

1. If you're a contributor likely to be contributing modifications to this repository, [create a fork of the dashboard repository following this GitHub guide](https://help.github.com/articles/fork-a-repo). Our default main development branch is called `finished`.
1. `git clone https://github.com/your-username/dashboard.git`
1. `cd dashboard` (this repository's root)
2. `git remote add upstream https://github.com/code-dot-org/dashboard.git`
3. `git fetch upstream`
2. Install ruby build prerequisites (using rbenv) and MySQL:
    - OSX: Using [Homebrew](http://brew.sh/) to install:
      + Install Homebrew:
        - `ruby -e "$(curl -fsSL https://raw.github.com/Homebrew/homebrew/go/install)"`
      + Install packages using Homebrew:
        - `brew install rbenv git ruby-build mysql imagemagick`
      + Configure mysql:
        1. To have launchd start mysql at login:
            + `ln -sfv /usr/local/opt/mysql/*.plist ~/Library/LaunchAgents`
        2. Then to load mysql now:
            + `launchctl load ~/Library/LaunchAgents/homebrew.mxcl.mysql.plist`
        3. Or, if you don't want/need launchctl, you can just run:
            + `mysql.server start`
        4. To connect:
            + `mysql -uroot`
      + Add this line to your ~/.profile to configure rbenv: `if which rbenv > /dev/null; then eval "$(rbenv init -)"; fi`
      + `source ~/.profile`
    - EC2: using pre-built AMI
      + Launch an instance using the AMI identifier `ami-f56a739c`, or by [clicking here](https://console.aws.amazon.com/ec2/v2/home?region=us-east-1#LaunchInstanceWizard:ami=ami-f56a739c)
      + This includes an install of `blockly` as well
    - Ubuntu: using apt-get
      + install MySQL packages and other prerequisites (**note: leave MySQL root password blank when prompted**): `sudo apt-get install mysql-client mysql-server libmysqlclient-dev libmagickwand-dev imagemagick`
      + Start service (should auto-start on system boot): `sudo start mysql`
      + To connect:
        - `mysql`
      + Since the repository packages are out of date, you need to install rbenv and ruby-build from source (follow these [instructions](http://gorails.com/setup#ruby-rbenv))

3. Install our ruby version through rbenv (takes a while)
    - `rbenv install 2.0.0-p247`
    - `rbenv global 2.0.0-p247`
    - `rbenv local 2.0.0-p247`

4. Install required gems (say “Yes” if asked to overwrite system rake)
    - `gem install bundler`
    - `gem install rake mailcatcher`
    - an `rbenv rehash` may be required to get the new tools into your path

6. Install project gems
    - `bundle`
    - Note: if you hadn’t installed rails before this, you may need another `rbenv rehash` here.

7. Setup database:
    - `bundle exec rake db:create`
    - `bundle exec rake db:migrate`
    - `bundle exec rake seed:all`

8. <a name="symlink"/>If you'll be modifying blockly as well (see above), you can use this rake task to symlink Dashboard to use your development version of Blockly
    - `bundle exec rake 'blockly:dev[../blockly]'`

### Starting the Server

1. Start [mailcatcher](http://mailcatcher.me/) (installed during core gem install phase)
    - `mailcatcher --ip=0.0.0.0`

2. Start rails.
    - `bundle exec rails s`
    - Go to [http://localhost:3000](http://localhost:3000) to see the Blockly running within Dashboard.

### Sending mail

The application sometimes sends an email, for example when a student attaches to a teacher.  This requires *mailcatcher* to be manually
installed on your system.  Mailcatcher should not be added to the Gemfile, rather it should be manually installed and run, like so:
```shell
gem install mailcatcher
rbenv rehash  # if using rbenv
mailcatcher
```
(Note that you might need to open a new shell session for it to be found in the path.)

### Adding an Admin Account

1. Create a first user which will be your admin (be sure to have `mailcatcher` running during signup)
2. `bundle exec rails c`
3. `User.first.update(admin: true)`

### Windows-specific notes

[These notes](https://github.com/code-dot-org/dashboard/blob/master/README_Windows.md) (unmaintained) may be useful for Windows 7/8 usage for those helping with IE 8/9/10 support.

## Contributing

We'd love to have you join our group of contributors!

### Before You Push

Anyone who would like to contribute to **[code.org](https://github.com/code-dot-org/)** projects **must read and sign the Contribution License Agreement**. We aren't able to accept any pull requests from contributors who haven't signed the CLA first.

For the time being—email [brian@code.org](mailto:brian@code.org) to get an electronic CLA to sign (takes less than a minute).

### Getting Started Contributing

#### HipChat room

[Join our community development HipChat room](http://www.hipchat.com/gBebkHP6g) for help getting set up, picking a task, etc. We're happy to have you!

If you want to make sure you get our attention, include an **@all** (everyone) or **@here** (everyone currently in the room) in your message.

#### Pivotal Tracker

We pull our tasks from a Pivotal Tracker and mark certain tickets as volunteer-friendly.

For the time being—for access to Pivotal Tracker, email [brian@code.org](mailto:brian@code.org).

## Submitting Pull Requests

Contributors should follow the GitHub [fork-and-pull model](https://help.github.com/articles/using-pull-requests) to submit pull requests into this repository.

1. On your fork, either push to your own finished branch or checkout a new branch for your feature
    - `git checkout -b branch_name`
2. Develop the new feature and push the changes to **your** fork and branch
    - `git add YYY`
    - `git commit -m "ZZZ"`
    - `git push origin branch_name`
3. Go to the dashboard GitHub page
    - [https://github.com/code-dot-org/dashboard](https://github.com/code-dot-org/dashboard)
4. Click on the "Pull Request" link, look over your diff, and submit it to others to review.
    - For bonus points, include screenshots. Command + Ctrl + Shift + 4 in OS X lets you copy a screen selection to your clipboard, which GitHub will let you paste right into the description
