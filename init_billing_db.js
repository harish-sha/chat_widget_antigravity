const db = require("./db");

const sqlPlans = `
CREATE TABLE IF NOT EXISTS saas_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plan_code VARCHAR(100) UNIQUE,
  name VARCHAR(255),
  price_monthly DECIMAL(10,2),
  stripe_price_id VARCHAR(255),
  max_ai_queries INT DEFAULT 1000,
  max_agents INT DEFAULT 1,
  features_json JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const sqlSubscriptions = `
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  widget_id VARCHAR(50) UNIQUE,
  plan_code VARCHAR(100),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  status VARCHAR(100) DEFAULT 'inactive',
  current_period_end TIMESTAMP NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (widget_id) REFERENCES users(widget_id) ON DELETE CASCADE
);
`;

db.query(sqlPlans, (err) => {
  if (err) console.error("Error creating saas_plans", err);
  db.query(sqlSubscriptions, (err) => {
    if (err) console.error("Error creating subscriptions", err);
    console.log("SUCCESS: Core Billing & Financial Schemas Fully Migrated.");
    process.exit(0);
  });
});
