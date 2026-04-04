const db = require("./db");

const sqlMedia = `
CREATE TABLE IF NOT EXISTS uploaded_media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  widget_id VARCHAR(50) NULL,
  uploader_id INT NULL,
  file_name VARCHAR(500),
  original_name VARCHAR(500),
  mime_type VARCHAR(100),
  file_size INT,
  url VARCHAR(1000),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

db.query(sqlMedia, (err) => {
  if (err) console.error("Error creating uploaded_media", err);
  console.log("SUCCESS: Enterprise Media Asset Schema Migrated.");
  process.exit(0);
});
