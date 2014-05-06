require "csv"

class LevelsController < ApplicationController
  include LevelsHelper
  include ActiveSupport::Inflector
  before_filter :authenticate_user!
  before_filter :can_modify?, except: [:show, :index]
  skip_before_filter :verify_params_before_cancan_loads_model, :only => [:create, :update_blocks]
  load_and_authorize_resource :except => [:create]
  check_authorization

  before_action :set_level, only: [:show, :edit, :update, :destroy]

  # GET /levels
  # GET /levels.json
  def index
    @game = Game.find(params[:game_id])
    @levels = @game.levels
  end

  # GET /levels/1
  # GET /levels/1.json
  def show
    set_videos_and_blocks_and_callouts

    @fallback_response = {
      success: {message: 'good job'},
      failure: {message: 'try again'}
    }

    @full_width = true
  end

  # GET /levels/1/edit
  def edit
    level = Level.find(params[:id])
  end

  # Action for using blockly workspace as a toolbox/startblock editor.
  # Expects params[:type] which can be either 'toolbox_blocks' or 'start_blocks'
  def edit_blocks
    authorize! :manage, :level
    @level = Level.find(params[:level_id])
    @start_blocks = @level.properties[params[:type]].presence || @level[params[:type]]
    @toolbox_blocks = @level.complete_toolbox  # Provide complete toolbox for editing start/toolbox blocks.
    @game = @level.game
    @full_width = true
    @callback = game_level_update_blocks_path @game, @level, params[:type]
    show
    render :show
  end

  def update_blocks
    authorize! :manage, :level
    @level = Level.find(params[:level_id])
    @level.properties[params[:type]] = params[:program]
    @level.save
    render json: { redirect: game_level_url(@level.game, @level) }
  end

  def update
    if @level.update(level_params)
      redirect_to game_level_url(@level.game, @level)
    else
      render json: @level.errors, status: :unprocessable_entity
    end
  end

  # POST /levels
  # POST /levels.json
  def create
    authorize! :create, :level
    type_class = level_params[:type].constantize

    # Set some defaults.
    params[:level].reverse_merge!(skin: type_class.skins.first)
    params.merge!(user: current_user)

    begin
      @level = type_class.create_from_level_builder(params, level_params)
    rescue ArgumentError
      render status: :not_acceptable, text: "There is a non integer value in the grid." and return
    end

    render json: { redirect: game_level_url(@level.game, @level) }
  end

  # DELETE /levels/1
  # DELETE /levels/1.json
  def destroy
    @level.destroy
    redirect_to(params[:redirect] || game_levels_url)
  end

  def new
    authorize! :create, :level
    @type = params[:type]
    case @type
    when 'Artist'
      artist_builder
    when 'Maze', 'Karel'
      @game = Game.custom_maze
      @level = Level.new
      render :maze_builder
    end
    @levels = Level.where(user: current_user)
  end

  def artist_builder
    authorize! :create, :level
    @level = Level.builder
    @game = @level.game
    @full_width = true
    @artist_builder = true
    @callback = game_levels_path @game
    @level.x = Integer(params[:x]) rescue nil
    @level.y = Integer(params[:y]) rescue nil
    @level.start_direction = Integer(params[:start_direction]) rescue nil
    show
    render :show
  end

  def can_modify?
    if !Rails.env.in?(["staging", "development"])
      render text: "Cannot create or modify levels from this environment.", status: :forbidden
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_level
      @level = Level.find(params[:id])
      @game = @level.game || Game.find(params[:game_id])
    end

    # Never trust parameters from the scary internet, only allow the white list through.
    def level_params
      params[:level].permit([:name, :type, :level_url, :level_num, :skin, :instructions, :x, :y, :start_direction, :user, :step_mode, {concept_ids: []}])
    end
end
