const db = require("../db");

// --- API explicitly shielded exclusively for the Super Admin Root ---

// Adds a physically available Plan to the database architecture mapping to a Stripe Price
exports.createPlan = (req, res) => {
   const { planCode, name, priceMonthly, stripePriceId, maxAiQueries, maxAgents, features } = req.body;
   
   if (!planCode || !stripePriceId) return res.status(400).json({ error: "Missing highly critical planCode or Stripe ID mappings." });

   const sql = `
     INSERT INTO saas_plans (plan_code, name, price_monthly, stripe_price_id, max_ai_queries, max_agents, features_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)
   `;

   db.query(sql, [planCode, name, priceMonthly || 0, stripePriceId, maxAiQueries || 100, maxAgents || 1, JSON.stringify(features || {})], (err) => {
       if (err) return res.status(500).json({ error: "Duplicate plan_code or schema error: " + err.message });
       res.json({ success: true, message: `High-Tier Plan '${name}' officially mapped to the ecosystem!` });
   });
};

// Gets all plans for the Admin Dashboard to modify pricing heavily
exports.getAllPlans = (req, res) => {
   db.query(`SELECT * FROM saas_plans ORDER BY price_monthly ASC`, (err, results) => {
       if (err) return res.status(500).json({ error: err.message });
       
       const parsedRaw = results.map(r => ({
           ...r,
           features_json: typeof r.features_json === 'string' ? JSON.parse(r.features_json) : r.features_json
       }));

       res.json({ success: true, count: parsedRaw.length, plans: parsedRaw });
   });
};

// Gives the God-Mode Admin a physical overview of exactly who is paying actively and who bounced
exports.getGlobalSubscriptions = (req, res) => {
   const sql = `
      SELECT sub.*, usr.email, usr.name as owner_name 
      FROM subscriptions sub
      LEFT JOIN users usr ON sub.widget_id = usr.widget_id
      ORDER BY sub.updated_at DESC
   `;

   db.query(sql, [], (err, results) => {
       if (err) return res.status(500).json({ error: err.message });
       res.json({ success: true, active_subscribers: results.length, data: results });
   });
};
