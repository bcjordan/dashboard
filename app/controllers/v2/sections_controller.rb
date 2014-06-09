module V2; class SectionsController < ApplicationController

  skip_before_action :verify_authenticity_token

  @@sections = [
    {id:1, name:'First', role: :teacher},
    {id:2, name:'Second', role: :teacher},
    {id:3, name:'Student', role: :student},
  ]

  def index
    sections_content!(get_my_sections)
  end

  def create
    return forbidden! unless am_teacher?
    section = create_section(params)
    redirect_to "/v2/sections/#{section[:id]}", status: :created
  end

  def show
    section = get_section(params[:id])
    section_content!(section)
  end

  def update
    section = get_section(params[:id])
    return forbidden! unless section and section[:role] == :teacher
    section = update_section(section, params)
    section_content!(section)
  end

  def destroy
    section = get_section(params[:id])
    return forbidden! unless section and section[:role] == :teacher
    destroy_section(section[:id])
    no_content!
  end

  private

  def am_teacher?()
    true
  end

  def create_section(params)
    id = @@sections.count + 1

    section = {
      id:id,
      name:params[:name],
      role: :teacher,
    }
    section[:secret_word] = params[:secret_word] if params.has_key?(:secret_word)
    section[:secret_picture] = params[:secret_picture] if params.has_key?(:secret_picture)

    @@sections << section
  end

  def destroy_section(id)
    id = id.to_i
    @@sections.delete_if{|i| i[:id] == id}
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
    id = id.to_i
    @@sections.select{|i| i[:id] == id}.first
  end

  def no_content!()
    render text:'No Content', status: :no_content, content_type:'text/plain'
  end

  def section_content!(section)
    return forbidden! unless section
    render json:filter_section_fields_by_role(section)
  end

  def sections_content!(sections)
    render json:{
      student:sections[:student].map{|i| filter_section_fields_by_role(i)},
      teacher:sections[:teacher].map{|i| filter_section_fields_by_role(i)},
    }
  end

  def update_section(section, params)
    section[:name] = params[:name] if params.has_key?(:name)
    section
  end

end; end
