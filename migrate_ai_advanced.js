const db = require('./db');

const queries = [
  `ALTER TABLE widget_ai_settings 
      ADD COLUMN model VARCHAR(50) DEFAULT 'gpt-3.5-turbo',
      ADD COLUMN temperature DECIMAL(3,2) DEFAULT 0.70,
      ADD COLUMN max_tokens INT DEFAULT 500,
      ADD COLUMN fallback_message TEXT NULL;`
];

async function migrate() {
  for (let query of queries) {
    try {
      await new Promise((resolve, reject) => {
        db.query(query, (err) => {
           // Skip error if column already exists
          if (err && err.code !== 'ER_DUP_FIELDNAME') reject(err);
          else resolve();
        });
      });
      console.log("Executed schema update!");
    } catch (e) {
      console.error("Migration error:", e.message);
    }
  }
  process.exit(0);
}

migrate();
