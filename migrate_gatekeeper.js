const db = require("./db");

const sqlUsers = `
ALTER TABLE users 
ADD COLUMN current_month_ai_usage INT DEFAULT 0 AFTER is_active;
`;

db.query(sqlUsers, (err) => {
  if (err && !err.message.includes("Duplicate column name")) {
    console.error("Error altering users:", err.message);
  } else {
    console.log("users table safely rate-limiter aligned.");
    console.log("SUCCESS: SaaS Master Gatekeeper Schema Expanded Globally!");
  }
  process.exit(0);
});
