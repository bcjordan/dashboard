require "csv"

namespace :seed do
  task videos: :environment do
    Video.transaction do
      Video.reset_db
      CSV.read('config/videos.csv', { col_sep: "\t", headers: true }).each_with_index do |row, id|
        Video.create!(id: id + 1, key: row['Key'], youtube_code: row['YoutubeCode'], download: row['Download'])
      end
    end

    if !Rails.env.test?
      Rake::Task["youtube:thumbnails"].invoke
    end
  end

  task concepts: :environment do
    Concept.setup
  end

  task games: :environment do
    Game.setup
  end

  SCRIPTS_GLOB = Dir.glob('config/scripts/**/*.script').flatten
  file 'config/scripts/.seeded' => SCRIPTS_GLOB do |t|
    Rake::Task['seed:scripts'].invoke
    touch t.name
  end

  task scripts: [:environment, :games, :custom_levels] do
    Script.setup(Dir.glob("config/scripts/default/*.yml"), Dir.glob('config/scripts/**/*.script').flatten)
    Script.update_script_locales
  end

  # Generate the database entry from the custom levels json file
  task custom_levels: :environment do
    Level.transaction do
      JSON.parse(File.read("config/scripts/custom_levels.json")).each do |row|
        level = Level.where(name: row['name']).first_or_create
        row['solution_level_source_id'] = (s = row['properties']['solution_blocks']).present? && LevelSource.lookup(level, s).id
        row.delete 'id'
        level.update row
      end
    end
  end

  task callouts: :environment do
    Callout.transaction do
      Callout.reset_db
      # TODO if the id of the callout is important, specify it in the tsv
      # preferably the id of the callout is not important ;)
      Callout.find_or_create_all_from_tsv!('config/callouts.tsv')
    end
  end

  task trophies: :environment do
    # code in user.rb assumes that broze id: 1, silver id: 2 and gold id: 3.
    Trophy.transaction do
      Trophy.reset_db
      %w(Bronze Silver Gold).each_with_index do |trophy, id|
        Trophy.create!(id: id + 1, name: trophy, image_name: "#{trophy.downcase}trophy.png")
      end
    end
  end

  task prize_providers: :environment do
    PrizeProvider.transaction do
      PrizeProvider.reset_db
      # placeholder data - id's are assumed to start at 1 so prizes below can be loaded properly
      [{name: 'Apple iTunes', description_token: 'apple_itunes', url: 'http://www.apple.com/itunes/', image_name: 'itunes_card.jpg'},
      {name: 'Dropbox', description_token: 'dropbox', url: 'http://www.dropbox.com/', image_name: 'dropbox_card.jpg'},
      {name: 'Valve Portal', description_token: 'valve', url: 'http://www.valvesoftware.com/games/portal.html', image_name: 'portal2_card.png'},
      {name: 'EA Origin Bejeweled 3', description_token: 'ea_bejeweled', url: 'https://www.origin.com/en-us/store/buy/181609/mac-pc-download/base-game/standard-edition-ANW.html', image_name: 'bejeweled_card.jpg'},
      {name: 'EA Origin FIFA Soccer 13', description_token: 'ea_fifa', url: 'https://www.origin.com/en-us/store/buy/fifa-2013/pc-download/base-game/standard-edition-ANW.html', image_name: 'fifa_card.jpg'},
      {name: 'EA Origin SimCity 4 Deluxe', description_token: 'ea_simcity', url: 'https://www.origin.com/en-us/store/buy/sim-city-4/pc-download/base-game/deluxe-edition-ANW.html', image_name: 'simcity_card.jpg'},
      {name: 'EA Origin Plants vs. Zombies', description_token: 'ea_pvz', url: 'https://www.origin.com/en-us/store/buy/plants-vs-zombies/mac-pc-download/base-game/standard-edition-ANW.html', image_name: 'pvz_card.jpg'},
      {name: 'DonorsChoose.org $750', description_token: 'donors_choose', url: 'http://www.donorschoose.org/', image_name: 'donorschoose_card.jpg'},
      {name: 'DonorsChoose.org $250', description_token: 'donors_choose_bonus', url: 'http://www.donorschoose.org/', image_name: 'donorschoose_card.jpg'},
      {name: 'Skype', description_token: 'skype', url: 'http://www.skype.com/', image_name: 'skype_card.jpg'}].each_with_index do |pp, id|
        PrizeProvider.create!(pp.merge!({:id=>id + 1}))
      end
    end
  end

  task ideal_solutions: :environment do
    Level.all.map do |level|
      level_source_id_count_map = Hash.new(0)
      Activity.all.where(['level_id = ?', level.id]).order('id desc').limit(10000).each do |activity|
        level_source_id_count_map[activity.level_source_id] += 1 if activity.test_result >= Activity::FREE_PLAY_RESULT
      end
      best_level_source_id = level_source_id_count_map.max_by(&:second).try(:first)
      level.update_attributes(ideal_level_source_id: best_level_source_id) if best_level_source_id
    end
  end

  task :frequent_level_sources, [:freq_cutoff, :game_name] => :environment do |t, args|
    if args[:game_name]
      puts "Only crowdsourcing hints for " + args[:game_name]
    else
      puts "Crowdsourcing hints for all games."
    end
    # Among all the level_sources, find the ones that are submitted more than freq_cutoff times.
    FrequentUnsuccessfulLevelSource.update_all('active = false')
    freq_cutoff = args[:freq_cutoff].to_i > 0 ? args[:freq_cutoff].to_i : 100
    # 0: level_source_id, 1: level_id, 2: num_of_attempts
    Activity.connection.execute('select level_source_id, level_id, count(*) as num_of_attempts from activities where test_result < 30 group by level_source_id order by num_of_attempts DESC').each do |level_source|
      if !level_source.nil? && !level_source[0].nil? && !level_source[1].nil? && !level_source[2].nil?
        if level_source[2] >= freq_cutoff
          if is_standardized_level_source(level_source[0]) && is_targeted_game(args[:game_name], level_source[1])
            unsuccessful_level_source = FrequentUnsuccessfulLevelSource.where(
                level_source_id: level_source[0],
                level_id: level_source[1]).first_or_create
            unsuccessful_level_source.num_of_attempts = level_source[2]
            if LevelSourceHint.where(level_source_id: unsuccessful_level_source.level_source_id).size < 3
              unsuccessful_level_source.active = true
              unsuccessful_level_source.save!
            end
          end
        else
          break
        end
      end
    end
  end

  def is_standardized_level_source(level_source_id)
    level_source = LevelSource.find(level_source_id)
    if level_source
      !level_source.data.include? "xmlns=\"http://www.w3.org/1999/xhtml\""
    end
  end

  def is_targeted_game(game_name, level_id)
    !game_name || (Level.find(level_id) && Level.find(level_id).game.name == game_name)
  end

  task dummy_prizes: :environment do
    # placeholder data
    Prize.connection.execute('truncate table prizes')
    TeacherPrize.connection.execute('truncate table teacher_prizes')
    TeacherBonusPrize.connection.execute('truncate table teacher_bonus_prizes')
    10.times do |n|
      string = n.to_s
      Prize.create!(prize_provider_id: 1, code: "APPL-EITU-NES0-000" + string)
      Prize.create!(prize_provider_id: 2, code: "DROP-BOX0-000" + string)
      Prize.create!(prize_provider_id: 3, code: "VALV-EPOR-TAL0-000" + string)
      Prize.create!(prize_provider_id: 4, code: "EAOR-IGIN-BEJE-000" + string)
      Prize.create!(prize_provider_id: 5, code: "EAOR-IGIN-FIFA-000" + string)
      Prize.create!(prize_provider_id: 6, code: "EAOR-IGIN-SIMC-000" + string)
      Prize.create!(prize_provider_id: 7, code: "EAOR-IGIN-PVSZ-000" + string)
      TeacherPrize.create!(prize_provider_id: 8, code: "DONO-RSCH-OOSE-750" + string)
      TeacherBonusPrize.create!(prize_provider_id: 9, code: "DONO-RSCH-OOSE-250" + string)
      Prize.create!(prize_provider_id: 10, code: "SKYP-ECRE-DIT0-000" + string)
    end
  end

  task :import_users, [:file] => :environment do |t, args|
    CSV.read(args[:file], { col_sep: "\t", headers: true }).each do |row|
      User.create!(
          provider: User::PROVIDER_MANUAL,
          name: row['Name'],
          username: row['Username'],
          password: row['Password'],
          password_confirmation: row['Password'],
          birthday: row['Birthday'].blank? ? nil : Date.parse(row['Birthday']))
    end
  end

  def import_prize_from_text(file, provider_id, col_sep)
    Rails.logger.info "Importing prize codes from: " + file + " for provider id " + provider_id.to_s
    CSV.read(file, { col_sep: col_sep, headers: false }).each do |row|
      if row[0].present?
        Prize.create!(prize_provider_id: provider_id, code: row[0])
      end
    end
  end

  task :import_itunes, [:file] => :environment do |t, args|
    import_prize_from_text(args[:file], 1, "\t")
  end

  task :import_dropbox, [:file] => :environment do |t, args|
    import_prize_from_text(args[:file], 2, "\t")
  end

  task :import_valve, [:file] => :environment do |t, args|
    import_prize_from_text(args[:file], 3, "\t")
  end

  task :import_ea_bejeweled, [:file] => :environment do |t, args|
    import_prize_from_text(args[:file], 4, "\t")
  end

  task :import_ea_fifa, [:file] => :environment do |t, args|
    import_prize_from_text(args[:file], 5, "\t")
  end

  task :import_ea_simcity, [:file] => :environment do |t, args|
    import_prize_from_text(args[:file], 6, "\t")
  end

  task :import_ea_pvz, [:file] => :environment do |t, args|
    import_prize_from_text(args[:file], 7, "\t")
  end

  task :import_skype, [:file] => :environment do |t, args|
    import_prize_from_text(args[:file], 10, ",")
  end

  task :import_donorschoose_750, [:file] => :environment do |t, args|
    Rails.logger.info "Importing teacher prize codes from: " + args[:file] + " for provider id 8"
    CSV.read(args[:file], { col_sep: ",", headers: true }).each do |row|
      if row['Gift Code'].present?
        TeacherPrize.create!(prize_provider_id: 8, code: row['Gift Code'])
      end
    end
  end

  task :import_donorschoose_250, [:file] => :environment do |t, args|
    Rails.logger.info "Importing teacher bonus prize codes from: " + args[:file] + " for provider id 9"
    CSV.read(args[:file], { col_sep: ",", headers: true }).each do |row|
      if row['Gift Code'].present?
        TeacherBonusPrize.create!(prize_provider_id: 9, code: row['Gift Code'])
      end
    end
  end

  task analyze_data: [:ideal_solutions, :frequent_level_sources]

  task all: [:videos, :concepts, :scripts, :trophies, :prize_providers, :callouts]

end
