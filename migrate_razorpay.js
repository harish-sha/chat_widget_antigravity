const db = require("./db");

const sqlPlans = `
ALTER TABLE saas_plans 
ADD COLUMN razorpay_plan_id VARCHAR(255) NULL AFTER stripe_price_id;
`;

const sqlSubscriptions = `
ALTER TABLE subscriptions 
ADD COLUMN gateway_used VARCHAR(50) DEFAULT 'stripe' AFTER plan_code,
ADD COLUMN razorpay_subscription_id VARCHAR(255) NULL AFTER stripe_subscription_id;
`;

db.query(sqlPlans, (err) => {
  if (err && !err.message.includes("Duplicate column name")) {
    console.error("Error altering saas_plans:", err.message);
  } else {
    console.log("saas_plans safely dual-gateway aligned.");
  }

  db.query(sqlSubscriptions, (err) => {
    if (err && !err.message.includes("Duplicate column name")) {
      console.error("Error altering subscriptions:", err.message);
    } else {
      console.log("subscriptions safely dual-gateway aligned.");
      console.log("SUCCESS: Multi-Gateway Gateway Schema Expanded Globally!");
    }
    process.exit(0);
  });
});
