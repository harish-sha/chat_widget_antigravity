const db = require('./db');

const query = `
  CREATE TABLE IF NOT EXISTS ai_metrics_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    widget_id VARCHAR(100) NOT NULL,
    conversation_id VARCHAR(100) NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    temperature DECIMAL(3,2) NOT NULL,
    latency_ms INT NOT NULL,
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    is_fallback BOOLEAN DEFAULT FALSE,
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

db.query(query, (err) => {
  if (err) {
    console.error("Migration error:", err.message);
    process.exit(1);
  } else {
    console.log("Successfully created ai_metrics_log table!");
    process.exit(0);
  }
});
