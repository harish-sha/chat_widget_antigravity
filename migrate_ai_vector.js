const db = require('./db');

const addEmbedding = `ALTER TABLE ai_knowledge_base ADD COLUMN embedding JSON NULL`;
const addFileName = `ALTER TABLE ai_knowledge_base ADD COLUMN file_name VARCHAR(255) NULL`;

db.query(addEmbedding, (err) => {
  if (err && err.code !== 'ER_DUP_FIELDNAME') console.log(err.message);
  
  db.query(addFileName, (err2) => {
    if (err2 && err2.code !== 'ER_DUP_FIELDNAME') console.log(err2.message);
    console.log("Successfully migrated table!");
    process.exit(0);
  });
});
