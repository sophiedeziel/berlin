require 'test_helper'

class ArtificialIntelligencesControllerTest < ActionController::TestCase

  test ":create allows creating AIs using json" do
    basic_auth
    post :create, :artificial_intelligence => ai_params, :format => :json
    assert_response :created

    ai = ActiveSupport::JSON.decode(response.body)['artificial_intelligence']
    assert_equal 'Pro AI', ai['name']
    assert_equal users(:wako).id, ai['user_id']
  end

  test ":create create an AI for a organisation user using JSON" do
    basic_auth

    user = users(:organisation_user)
    post :create, :artificial_intelligence => ai_params, :user_id => user.id, :format => :json
    assert_response :created

    ai = ActiveSupport::JSON.decode(response.body)['artificial_intelligence']
    assert_equal user.id, ai['user_id']
  end

  test ":update can update an organisation member's AI through JSON" do
    basic_auth
    user = users(:organisation_user)
    params = ai_params.merge(:name => "New AI name")
    patch :update, :id => artificial_intelligences(:organisation_ai), :user_id => user.id, :artificial_intelligence => params, :format => :json

    ai = artificial_intelligences(:organisation_ai).reload
    assert_equal 'New AI name', ai.name
  end

  protected
  def ai_params
    {:name => 'Pro AI', :language => "Ruby", :url => "http://github.com", :is_active => true}
  end
end
