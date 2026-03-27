const db = require('./db');

const queries = [
  `CREATE TABLE IF NOT EXISTS widget_ai_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    widget_id VARCHAR(100) NOT NULL UNIQUE,
    is_enabled BOOLEAN DEFAULT FALSE,
    provider VARCHAR(50) DEFAULT 'openai',
    api_key VARCHAR(255) NULL,
    system_prompt TEXT NULL,
    tone VARCHAR(50) DEFAULT 'professional',
    grammar_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ai_knowledge_base (
    id INT AUTO_INCREMENT PRIMARY KEY,
    widget_id VARCHAR(100) NOT NULL,
    type VARCHAR(50) DEFAULT 'qna',
    content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE conversations ADD COLUMN bot_active BOOLEAN DEFAULT TRUE`
];

async function migrate() {
  for (let query of queries) {
    try {
      await new Promise((resolve, reject) => {
        db.query(query, (err) => {
          // Ignore duplicate column errors for safe re-runs
          if (err && err.code !== 'ER_DUP_FIELDNAME') reject(err);
          else resolve();
        });
      });
      console.log("Executed:", query.split(' ')[0], query.split(' ')[1] || '');
    } catch (e) {
      console.error("Migration error:", e.message);
    }
  }
  console.log("Migration complete!");
  process.exit(0);
}

migrate();
