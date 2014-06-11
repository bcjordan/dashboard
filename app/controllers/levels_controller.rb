require "csv"
require "naturally"

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
    @type_class = @level.type.try(:constantize)
    if @type_class == Maze || @type_class == Karel
      @level[:maze] = @level.class.unparse_maze(@level.properties)
    end
  end

  # Action for using blockly workspace as a toolbox/startblock editor.
  # Expects params[:type] which can be either 'toolbox_blocks' or 'start_blocks'
  def edit_blocks
    authorize! :manage, :level
    @level = Level.find(params[:level_id])
    @start_blocks = @level.properties[params[:type]].presence || @level[params[:type]]
    @toolbox_blocks = @level.complete_toolbox(params[:type])  # Provide complete toolbox for editing start/toolbox blocks.
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
    start_direction = Integer(level_params["start_direction"]) rescue nil
    if @level.update(level_params.merge!(start_direction: start_direction))
      render json: { redirect: game_level_url(@level.game, @level) }.to_json
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
    rescue ArgumentError => e
      render status: :not_acceptable, json: {error: e.message}.to_json and return
    rescue ActiveRecord::RecordInvalid => invalid
      render status: :not_acceptable, json: invalid.record.errors.to_json and return
    end

    render json: { redirect: game_level_url(@level.game, @level) }.to_json
  end

  # DELETE /levels/1
  # DELETE /levels/1.json
  def destroy
    @level.destroy
    redirect_to(params[:redirect] || game_levels_url)
  end

  def new
    authorize! :create, :level
    @type_class = params[:type].try(:constantize)

    # Can't use case/when because a constantized string does not === the class by that name.
    if @type_class == Artist
      artist_builder
    elsif @type_class == Maze || @type_class == Karel
      @game = Game.custom_maze
      @level = @type_class.new
      render :edit
    end
    @levels = Naturally.sort_by(Level.where(user: current_user), :name)
  end

  # POST /levels/1/clone
  def clone
    # Clone existing level and open edit page
    old_level = Level.find(params[:level_id])
    @level = old_level.dup
    # resolve duplicate name conflicts with 'X (copy); X (copy 2); X (copy 3)... X (copy 10)'
    name = "#{old_level.name} (copy 0)"
    begin result = @level.update(name: name.next!) end until result
    redirect_to(edit_game_level_url(@level.game, @level))
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
      params[:level].permit([:maze, :name, :type, :level_url, :level_num, :skin, :instructions, :x, :y, :start_direction, :user, :step_mode, :is_k1, :nectar_goal, :honey_goal, :flower_type, {concept_ids: []}])
    end
end
