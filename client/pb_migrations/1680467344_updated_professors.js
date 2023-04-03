migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("69xi7q3u9sh2w2s")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "rjirvzxe",
    "name": "numRatings",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("69xi7q3u9sh2w2s")

  // remove
  collection.schema.removeField("rjirvzxe")

  return dao.saveCollection(collection)
})
