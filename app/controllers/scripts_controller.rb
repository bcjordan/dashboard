class ScriptsController < ApplicationController
  before_filter :authenticate_user!, except: :show
  check_authorization
  before_action :set_script, only: [:show, :edit, :update, :destroy]
  authorize_resource
  before_action :set_script_file, only: [:edit, :update, :destroy]

  def index
    rake if params[:rake] == '1'
    # Show all the scripts that a user has created.
    @scripts = Script.all
  end

  def show
  end

  def edit
    if @script.default_script?
      render :status => :forbidden, :text => 'Default scripts not editable.'
    end
  end

  def update
    respond_to do |format|
      script_text = params[:script_text]
      if @script.update_text(script_params, script_text)
        format.html { redirect_to @script, notice: I18n.t('crud.updated', model: Script.model_name.human) }
        format.json { head :no_content }
      else
        format.html { render action: 'edit' }
        format.json { render json: @script.errors, status: :unprocessable_entity }
      end
    end
  end

  private
  def set_script_file
    filename = "config/scripts/#{@script.name}.script"
    @script_file = File.exists?(filename) && File.read(filename)
  end

  private

  def rake
    @errors = []
    begin
      Script.rake
      redirect_to scripts_path, notice: "Updated."
    rescue Exception => e
      @errors << e.to_s
      render action: 'index'
    end
  end

  def set_script
    @script = Script.get_from_cache(params[:id])
  end

  def script_params
    params.require(:script).permit(:name)
  end

end
