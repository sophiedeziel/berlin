require 'rubygems'
require 'sinatra'
require 'typhoeus'
require 'yajl/json_gem'
require 'active_record'
require 'uuidtools'
require 'utilities'

ROOT = File.expand_path( File.dirname( __FILE__ ) )

# default port
set :port, 3010

# options
options = Hash[*ARGV]

# config
default_env = ENV['RAILS_ENV'] ? ENV['RAILS_ENV'] : 'development'
environment = options['-e'] ? options['-e'] : default_env
config_path = ROOT + "/../config/database.yml"
config_file = File.open( config_path )
config_yaml = YAML::load( config_file )

# db connexion
ActiveRecord::Base.establish_connection( config_yaml[ environment ] )

# lib
%w( awardable ).each do |model|
  require ROOT + "/../lib/#{model}"
end

# models
%w( game map artificial_intelligence artificial_intelligence_game award ).each do |model|
  require ROOT + "/../app/models/#{model}"
end

# classes
%w( game map path artificial_intelligence node node_type move ).each do |model|
  require ROOT + "/#{model}"
end

# achievements
%w( achievement games_played_achievement victories_achievement ).each do |model|
  require ROOT + "/../app/models/achievements/#{model}"
end

get '/fight' do
  Thread.new do
    begin
      game = Berlin::Server::Game.new
      game.map = Berlin::Server::Map.find( params[:map_id] )
      game.players = Berlin::Server::ArtificialIntelligence.find( params[:ai_ids] )
      game.init
      game.debug = true
      game.run
    rescue Exception => e
      log e
    end
  end
end

# log to error file
def log error
  open('errors.log', 'a') do |f|
    f.puts "#{DateTime.now} : #{request.path_info} #{params.inspect}"
    f.puts e.inspect
    f.puts e.backtrace
    f.puts "--------------------------------------------------------"
  end
end
