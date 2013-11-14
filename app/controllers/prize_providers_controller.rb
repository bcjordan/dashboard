class PrizeProvidersController < ApplicationController
  before_action :set_prize_provider, only: [:show, :edit, :update, :destroy]

  # GET /prize_providers
  # GET /prize_providers.json
  def index
    @prize_providers = PrizeProvider.all
  end

  # GET /prize_providers/1
  # GET /prize_providers/1.json
  def show
  end

  # GET /prize_providers/new
  def new
    @prize_provider = PrizeProvider.new
  end

  # GET /prize_providers/1/edit
  def edit
  end

  # POST /prize_providers
  # POST /prize_providers.json
  def create
    @prize_provider = PrizeProvider.new(prize_provider_params)

    respond_to do |format|
      if @prize_provider.save
        format.html { redirect_to @prize_provider, notice: 'Prize provider was successfully created.' }
        format.json { render action: 'show', status: :created, location: @prize_provider }
      else
        format.html { render action: 'new' }
        format.json { render json: @prize_provider.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /prize_providers/1
  # PATCH/PUT /prize_providers/1.json
  def update
    respond_to do |format|
      if @prize_provider.update(prize_provider_params)
        format.html { redirect_to @prize_provider, notice: 'Prize provider was successfully updated.' }
        format.json { head :no_content }
      else
        format.html { render action: 'edit' }
        format.json { render json: @prize_provider.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /prize_providers/1
  # DELETE /prize_providers/1.json
  def destroy
    @prize_provider.destroy
    respond_to do |format|
      format.html { redirect_to prize_providers_url }
      format.json { head :no_content }
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_prize_provider
      @prize_provider = PrizeProvider.find(params[:id])
    end

    # Never trust parameters from the scary internet, only allow the white list through.
    def prize_provider_params
      params.require(:prize_provider).permit(:name, :url, :description_token, :image_name)
    end
end
