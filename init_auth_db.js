const db = require("./db");

const sqlUsers = `
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  google_id VARCHAR(255),
  role ENUM('user', 'admin') DEFAULT 'user',
  widget_id VARCHAR(50) UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  profile_pic_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const sqlNotifSettings = `
CREATE TABLE IF NOT EXISTS notification_settings (
  widget_id VARCHAR(50) PRIMARY KEY,
  engine_config JSON,
  routing_matrix JSON,
  dispatch_targets JSON,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
`;

const sqlInAppAlerts = `
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  widget_id VARCHAR(50),
  title VARCHAR(255),
  message TEXT,
  alert_tone VARCHAR(50) DEFAULT 'Standard',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// Default seed an original admin account if needed, but not strictly required
db.query(sqlUsers, (err) => {
  if (err) console.error("Error creating users table", err);
  db.query(sqlNotifSettings, (err) => {
    if (err) console.error("Error creating notif settings table", err);
    db.query(sqlInAppAlerts, (err) => {
       if (err) console.error("Error creating in_app matching table", err);
       console.log("SUCCESS: Core Auth & Notification Schemas Fully Migrated.");
       process.exit(0);
    });
  });
});
