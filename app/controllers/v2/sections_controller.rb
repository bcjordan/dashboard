module V2; class SectionsController < ApplicationController

  skip_before_action :verify_authenticity_token

  @@next_id = 3

  @@sections = {
    student:{
      3=>{id:3, name:'Student', role: :student},
    },
    teacher:{
      1=>{id:1, name:'First', role: :teacher},
      2=>{id:2, name:'Second', role: :teacher},
    }
  }

  def index
    render json:get_my_sections()
  end

  def create
    section = create_section(params[:name])
    redirect_to "/v2/sections/#{section[:id]}", status: :created
  end

  def show
    section = get_section(params[:id])
    return forbidden! unless section
    render json:section
  end

  def update
    section = get_section(params[:id])
    return forbidden! unless section
    return forbidden! unless section[:role] == :teacher
    render json:update_section(section, params)
  end

  def destroy
    section = get_section(params[:id])
    return forbidden! unless section
    return forbidden! unless section[:role] == :teacher
    destroy_section(section[:id])
    no_content!
  end

  private

  def create_section(name)
    id = @@next_id += 1

    section = {
      id:id,
      name:name,
      role: :teacher,
    }

    @@sections[:teacher][section[:id]] = section
  end

  def destroy_section(id)
    id = id.to_i
    @@sections[:teacher].delete(id)
  end

  def forbidden!()
    render text:'Forbidden', status: :forbidden, content_type:'text/plain'
  end

  def get_section(id)
    id = id.to_i
    section = @@sections[:teacher][id]
    section ||= @@sections[:student][id]
  end

  def get_my_sections()
    @@sections
  end

  def no_content!()
    render text:'No Content', status: :no_content, content_type:'text/plain'
  end

  def update_section(section, params)
    section[:name] = params[:name] if params.has_key?(:name)
    section
  end

end; end
