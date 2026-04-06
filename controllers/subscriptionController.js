const db = require("../db");
const stripeService = require("../services/stripeService");

// Get Active Plans for the UI Pricing Page
exports.getAvailablePlans = (req, res) => {
   // End-users should only see visually active plans meant to be purchased globally
   db.query(`SELECT id, plan_code, name, price_monthly, max_ai_queries, max_agents, features_json FROM saas_plans WHERE is_active = TRUE ORDER BY price_monthly ASC`, (err, results) => {
       if (err) return res.status(500).json({ error: err.message });
       
       const parsedRaw = results.map(r => ({
           ...r,
           features_json: typeof r.features_json === 'string' ? JSON.parse(r.features_json) : r.features_json
       }));

       res.json({ success: true, count: parsedRaw.length, plans: parsedRaw });
   });
};

// Gets the current mathematical limit states for this precise User/Tenant
exports.getMySubscription = (req, res) => {
   const widgetId = req.user.widgetId;
   
   const sql = `
       SELECT sub.status, sub.current_period_end, sub.cancel_at_period_end, pln.*
       FROM subscriptions sub 
       LEFT JOIN saas_plans pln ON sub.plan_code = pln.plan_code
       WHERE sub.widget_id = ?
   `;

   db.query(sql, [widgetId], (err, results) => {
       if (err) return res.status(500).json({ error: err.message });
       
       if (!results.length) {
          // If they've never bought anything, strictly return the free tier limits (System default)
          return res.json({
             success: true,
             has_subscription: false,
             limits: {
                 max_ai_queries: 100, // Hardcoded Free Tier Limits
                 max_agents: 1,
                 status: "free"
             }
          });
       }

       // Parse the row
       const row = results[0];
       res.json({
          success: true,
          has_subscription: true,
          status: row.status, // "active", "past_due"
          current_period_end: row.current_period_end,
          limits: {
              plan_code: row.plan_code,
              name: row.name,
              max_ai_queries: row.max_ai_queries,
              max_agents: row.max_agents,
              features_json: typeof row.features_json === 'string' ? JSON.parse(row.features_json) : (row.features_json || {}) 
          }
       });
   });
};

// Generates the massive physical URL bounding them to Stripe or Razorpay's payment form
exports.createCheckout = (req, res) => {
   const { planCode, gateway } = req.body; // 'stripe' or 'razorpay'
   const widgetId = req.user.widgetId;
   const email = req.user.email; // Pulled straight from JWT logic securely

   if (!gateway || !['stripe', 'razorpay'].includes(gateway)) {
       return res.status(400).json({ error: "Critically invalid or missing payment Gateway. Must be 'stripe' or 'razorpay'." });
   }

   db.query(`SELECT stripe_price_id, razorpay_plan_id FROM saas_plans WHERE plan_code = ? AND is_active = TRUE`, [planCode], async (err, results) => {
       if (err) return res.status(500).json({ error: err.message });
       if (!results.length) return res.status(400).json({ error: "Critically invalid plan explicitly requested." });

       const row = results[0];
       
       try {
           if (gateway === 'stripe') {
               if (!row.stripe_price_id) return res.status(400).json({ error: "This specific plan is not mapped globally to Stripe." });
               const checkoutUrl = await stripeService.createCheckoutSession(row.stripe_price_id, widgetId, email);
               res.json({ success: true, gateway: 'stripe', url: checkoutUrl });
           } 
           else if (gateway === 'razorpay') {
               const razorpayService = require("../services/razorpayService");
               if (!row.razorpay_plan_id) return res.status(400).json({ error: "This specific plan is not mapped to the Indian Razorpay Gateway." });
               const razorData = await razorpayService.createCheckoutSession(row.razorpay_plan_id, widgetId, email);
               res.json({ success: true, gateway: 'razorpay', url: razorData.url, subscription_id: razorData.subscription_id });
           }
       } catch (e) {
           res.status(500).json({ error: `Failed to compile ${gateway.toUpperCase()} Engine checkout`, details: e.message });
       }
   });
};

// Autonomously redirects them into Stripe so they can fetch their PDFs or cancel heavily
exports.createPortal = (req, res) => {
   const widgetId = req.user.widgetId;

   db.query(`SELECT stripe_customer_id FROM subscriptions WHERE widget_id = ?`, [widgetId], async (err, results) => {
       if (err) return res.status(500).json({ error: err.message });
       if (!results.length || !results[0].stripe_customer_id) return res.status(400).json({ error: "You possess no active subscriptions securely tied to Stripe." });

       const customerId = results[0].stripe_customer_id;
       
       try {
           const portalUrl = await stripeService.createBillingPortalSession(customerId);
           res.json({ success: true, url: portalUrl });
       } catch (e) {
           res.status(500).json({ error: "Failed resolving Stripe Engine Portal", details: e.message });
       }
   });
};

// Manually Verifies a Subscription Status if Webhooks fail locally (Bypass)
exports.createVerify = (req, res) => {
   const { subscriptionId, gateway } = req.body;
   const widgetId = req.user.widgetId;

   if (!subscriptionId || !gateway) return res.status(400).json({ error: "Missing highly critical subscription verification identifiers" });

   if (gateway === 'razorpay') {
       const razorpayService = require("../services/razorpayService");
       razorpayService.razorpay.subscriptions.fetch(subscriptionId).then(sub => {
           if (sub.status === 'active') {
               const planId = sub.plan_id;
               const customerId = sub.customer_id || 'manual_sync_customer';
               db.query(`SELECT plan_code FROM saas_plans WHERE razorpay_plan_id = ? LIMIT 1`, [planId], (err, results) => {
                   if (err || !results.length) return res.status(400).json({ error: "Invalid Razorpay plan inside verification." });
                   const planCode = results[0].plan_code;
                   const upsertSql = `
                      INSERT INTO subscriptions (widget_id, gateway_used, plan_code, stripe_customer_id, razorpay_subscription_id, status, current_period_end)
                      VALUES (?, 'razorpay', ?, ?, ?, 'active', FROM_UNIXTIME(?))
                      ON DUPLICATE KEY UPDATE 
                         gateway_used = 'razorpay', plan_code = ?, stripe_customer_id = ?, razorpay_subscription_id = ?, status = 'active', current_period_end = FROM_UNIXTIME(?)
                   `;
                   const values = [widgetId, planCode, customerId, subscriptionId, sub.current_end, planCode, customerId, subscriptionId, sub.current_end];
                   db.query(upsertSql, values, () => {
                       res.json({ success: true, message: "Manual Razorpay Verification Succeeded! Database Flipped to Active.", status: 'active' });
                   });
               });
           } else {
               res.status(400).json({ error: "Razorpay Native API confirms subscription is NOT active." });
           }
       }).catch(e => {
           const rzpDesc = Object.keys(e).length ? JSON.stringify(e) : String(e);
           res.status(500).json({ error: "Failed to deeply verify with Razorpay", details: rzpDesc });
       });
   } else if (gateway === 'stripe') {
       res.status(400).json({ error: "Please rely on native Stripe Webhooks for Stripe testing, or pass Razorpay" });
   }
};

// Universal Cancel (Native API termination independent of WebUIs)
exports.createCancel = (req, res) => {
   const widgetId = req.user.widgetId;

   db.query(`SELECT gateway_used, stripe_subscription_id, razorpay_subscription_id FROM subscriptions WHERE widget_id = ? AND status = 'active'`, [widgetId], async (err, results) => {
       if (err) return res.status(500).json({ error: err.message });
       if (!results.length) return res.status(400).json({ error: "No active subscription physical row found to terminate." });
       
       const row = results[0];
       try {
           if (row.gateway_used === 'stripe') {
               const stripeService = require("../services/stripeService");
               await stripeService.stripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: true });
               db.query(`UPDATE subscriptions SET cancel_at_period_end = 1 WHERE widget_id = ?`, [widgetId]);
               res.json({ success: true, message: "Stripe Subscription canceled cleanly at period end." });
           } else if (row.gateway_used === 'razorpay') {
               const razorpayService = require("../services/razorpayService");
               // Cancel at end of cycle -> false parameter (do not cancel immediately, wait till end)
               await razorpayService.razorpay.subscriptions.cancel(row.razorpay_subscription_id, false);
               db.query(`UPDATE subscriptions SET cancel_at_period_end = 1 WHERE widget_id = ?`, [widgetId]);
               res.json({ success: true, message: "Razorpay Subscription formally canceled natively at period end." });
           }
       } catch(e) {
           res.status(500).json({ error: "Failed Universal Gateway Termination Array", details: String(e) });
       }
   });
};
