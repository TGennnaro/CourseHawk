migrate((db) => {
  const collection = new Collection({
    "id": "e7ldrsyocu5h9hx",
    "created": "2023-04-02 19:54:48.665Z",
    "updated": "2023-04-02 19:54:48.665Z",
    "name": "classes",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "qqkvxgbz",
        "name": "number",
        "type": "text",
        "required": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
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
      },
      {
        "system": false,
        "id": "vpowjm2e",
        "name": "name",
        "type": "text",
        "required": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "j4dqa5vs",
        "name": "term",
        "type": "text",
        "required": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "2p4u2umv",
        "name": "credits",
        "type": "number",
        "required": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null
        }
      }
    ],
    "indexes": [],
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("e7ldrsyocu5h9hx");

  return dao.deleteCollection(collection);
})
