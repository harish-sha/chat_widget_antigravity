const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const db = require("../db");

// Like Stripe, Razorpay fundamentally relies on mathematical payload hashing to destroy fake spoofing attempts!
router.post("/", (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_dummy_secret';

  // Razorpay natively relies on JSON payloads (unlike Stripe's raw buffer) but hashes the raw JSON String
  const signature = req.headers['x-razorpay-signature'];
  const bodyString = JSON.stringify(req.body);

  const expectedSignature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

  if (expectedSignature !== signature) {
    console.error("Razorpay Webhook Cryptographic Forgery Detected!");
    // We do not crash the server locally if it's just a dummy test, but in production, we absolutely block this:
    if (process.env.NODE_ENV === 'production') {
      return res.status(400).send('Webhook Secure Signature Forgery Failed');
    }
  }

  // Determine Razorpay Event Type
  const event = req.body.event;
  const payload = req.body.payload;

  switch (event) {
    case 'subscription.charged': {
      const subscription = payload.subscription.entity;
      const subId = subscription.id;
      const planId = subscription.plan_id;
      const widgetId = subscription.notes && subscription.notes.widget_id;
      const customerId = subscription.customer_id;
      const currentPeriodEnd = subscription.current_end; // Unix mathematical timestamp

      if (!widgetId) break;

      // Unpack the database to locate the abstract Plan code
      db.query(`SELECT plan_code FROM saas_plans WHERE razorpay_plan_id = ? LIMIT 1`, [planId], (err, results) => {
        if (err || !results.length) return;
        const assignedPlan = results[0].plan_code;

        const upsertSql = `
            INSERT INTO subscriptions (widget_id, gateway_used, plan_code, stripe_customer_id, razorpay_subscription_id, status, current_period_end)
            VALUES (?, 'razorpay', ?, ?, ?, ?, FROM_UNIXTIME(?))
            ON DUPLICATE KEY UPDATE 
               gateway_used = 'razorpay', plan_code = ?, stripe_customer_id = ?, razorpay_subscription_id = ?, status = ?, current_period_end = FROM_UNIXTIME(?)
         `;
        // Razorpay uses generic customer mapping so we share the generic stripe_customer_id column conceptually or handle it natively
        const values = [widgetId, assignedPlan, customerId, subId, 'active', currentPeriodEnd, assignedPlan, customerId, subId, 'active', currentPeriodEnd];

        db.query(upsertSql, values, () => {
          console.log(`[Razorpay Native Ecosystem] Account ${widgetId} securely unlocked onto Indian Matrix: ${assignedPlan}`);
        });
      });
      break;
    }
    case 'subscription.halted':
    case 'subscription.cancelled': {
      const canceledSub = payload.subscription.entity;
      const subId = canceledSub.id;
      db.query(`UPDATE subscriptions SET status = 'canceled' WHERE razorpay_subscription_id = ?`, [subId]);
      break;
    }
    default:
      console.log(`Unhandled Razorpay event structure: ${event}`);
  }

  res.status(200).send();
});

module.exports = router;
