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

// Generates the massive physical URL bounding them to Stripe's payment form
exports.createCheckout = (req, res) => {
   const { planCode } = req.body;
   const widgetId = req.user.widgetId;
   const email = req.user.email; // Pulled straight from JWT logic securely

   db.query(`SELECT stripe_price_id FROM saas_plans WHERE plan_code = ? AND is_active = TRUE`, [planCode], async (err, results) => {
       if (err) return res.status(500).json({ error: err.message });
       if (!results.length) return res.status(400).json({ error: "Critically invalid plan explicitly requested." });

       const StripePrice = results[0].stripe_price_id;
       
       try {
           const checkoutUrl = await stripeService.createCheckoutSession(StripePrice, widgetId, email);
           res.json({ success: true, url: checkoutUrl });
       } catch (e) {
           res.status(500).json({ error: "Failed to compile Stripe Engine checkout", details: e.message });
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
