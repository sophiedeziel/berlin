class CreateOrganisations < ActiveRecord::Migration
  def change
    create_table :organisations do |t|
      t.string :name
      t.references :user

      t.timestamps
    end
  end
end
