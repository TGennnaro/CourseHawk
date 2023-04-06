migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("e7ldrsyocu5h9hx")

  collection.name = "courses"

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("e7ldrsyocu5h9hx")

  collection.name = "classes"

  return dao.saveCollection(collection)
})
