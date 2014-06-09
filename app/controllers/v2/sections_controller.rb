module V2; class SectionsController < ApplicationController

  skip_before_action :verify_authenticity_token

  @@sections = [
    {id:1, name:'First', role: :teacher},
    {id:2, name:'Second', role: :teacher},
    {id:3, name:'Student', role: :student},
  ]
  @@last_id = @@sections.count

  def index
    render_sections get_my_sections
  end

  def create
    section = create_section(params)
    return forbidden! unless section
    redirect_to "/v2/sections/#{section[:id]}", status: :created
  end

  def show
    render_section get_section(params[:id].to_i)
  end

  def update
    render_section update_section(params[:id].to_i, params)
  end

  def destroy
    section = destroy_section(params[:id].to_i)
    return forbidden! unless section
    render text:'', status: :no_content, content_type:'text/plain'
  end

  private

  def am_teacher?()
    true
  end

  def create_section(params)
    return nil unless am_teacher?

    id = @@last_id += 1

    section = {
      id:id,
      name:params[:name],
      role: :teacher,
    }
    section[:secret_word] = params[:secret_word] if params.has_key?(:secret_word)
    section[:secret_picture] = params[:secret_picture] if params.has_key?(:secret_picture)

    @@sections << section

    section
  end

  def destroy_section(id)
    section = get_section(id)
    return nil unless section and section[:role] == :teacher
    @@sections.delete_if{|i| i[:id] == id}
    section
  end

  def filter_section_fields_by_role(section)
    response = {}

    response[:id] = section[:id]
    response[:name] = section[:name]
    response[:role] = section[:role]

    if section[:role] == :teacher
      response[:secret_word] = section[:secret_word]
      response[:secret_picture] = section[:secret_picture]
    end

    response
  end

  def forbidden!()
    render text:'Forbidden', status: :forbidden, content_type:'text/plain'
  end

  def get_my_sections()
    student = []
    teacher = []

    @@sections.each do |i|
      puts i.to_json
      if i[:role] == :teacher
        teacher << i
      elsif i[:role] == :student
        student << i
      else
        raise 'Unknown Role'
      end
    end

    {student:student, teacher:teacher}
  end

  def get_section(id)
    @@sections.select{|i| i[:id] == id}.first
  end

  def render_section(section)
    return forbidden! unless section
    render json:filter_section_fields_by_role(section)
  end

  def render_sections(sections)
    render json:{
      student:sections[:student].map{|i| filter_section_fields_by_role(i)},
      teacher:sections[:teacher].map{|i| filter_section_fields_by_role(i)},
    }
  end

  def update_section(id, params)
    section = get_section(id)
    return nil unless section and section[:role] == :teacher
    section[:name] = params[:name] if params.has_key?(:name)
    section
  end

end; end
