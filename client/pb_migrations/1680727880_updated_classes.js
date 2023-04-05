migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("e7ldrsyocu5h9hx")

  // update
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "byaxrpm8",
    "name": "professor",
    "type": "relation",
    "required": false,
    "unique": false,
    "options": {
      "collectionId": "69xi7q3u9sh2w2s",
      "cascadeDelete": false,
      "minSelect": null,
      "maxSelect": null,
      "displayFields": [
        "id"
      ]
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("e7ldrsyocu5h9hx")

  // update
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "byaxrpm8",
    "name": "professor",
    "type": "relation",
    "required": false,
    "unique": false,
    "options": {
      "collectionId": "69xi7q3u9sh2w2s",
      "cascadeDelete": false,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": [
        "id"
      ]
    }
  }))

  return dao.saveCollection(collection)
})
