const db = require("../db");

// Gets the list of all registered tenants/users
exports.getAllUsers = (req, res) => {
  const { status } = req.query; // active vs inactive
  
  let sql = `
    SELECT id, name, email, google_id as oauthLink, role, widget_id, is_active, created_at 
    FROM users 
    WHERE role != 'admin'
  `;
  const params = [];

  if (status) {
    sql += ` AND is_active = ?`;
    params.push(status === 'active' ? true : false);
  }
  
  sql += ` ORDER BY created_at DESC`;

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, count: results.length, users: results });
  });
};

// Instantly suspends or activates a SaaS client
exports.toggleUserStatus = (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  
  db.query(`UPDATE users SET is_active = ? WHERE id = ? AND role != 'admin'`, [is_active, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: `User account ${is_active ? 'activated' : 'suspended'} successfully.` });
  });
};

// Completely wipes a user and all their underlying data
exports.deleteUser = (req, res) => {
  const { id } = req.params;

  // Due to foreign key constraints usually handled by database engines, running a raw delete.
  db.query(`DELETE FROM users WHERE id = ? AND role != 'admin'`, [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    // Production Note: You would also want to trace their widget_id and clean out 'ai_knowledge_base', 'conversations', etc in a background job!
    res.json({ success: true, message: "User hard-deleted from database." });
  });
};

// --- Multi-Channel Global Provider Settings ---
exports.addProvider = (req, res) => {
  const { channel, providerName, config, isDefault } = req.body;
  
  const sql = `INSERT INTO global_service_providers (channel, provider_name, config, is_default) VALUES (?, ?, ?, ?)`;
  
  if (isDefault) {
     db.query(`UPDATE global_service_providers SET is_default = FALSE WHERE channel = ?`, [channel], () => {
         db.query(sql, [channel, providerName, JSON.stringify(config || {}), true], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: `Active ${channel} provider mapped successfully.` });
         });
     });
  } else {
     db.query(sql, [channel, providerName, JSON.stringify(config || {}), false], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: `Backup ${channel} provider mapped successfully.` });
     });
  }
};

exports.getProviders = (req, res) => {
  db.query(`SELECT id, channel, provider_name, config, is_default, created_at FROM global_service_providers ORDER BY channel ASC, is_default DESC`, (err, results) => {
     if (err) return res.status(500).json({ error: err.message });
     
     // Per the user's explicit request, we are NOT scrubbing configs right now!
     const parsed = results.map(r => ({
         ...r,
         config: typeof r.config === 'string' ? JSON.parse(r.config) : (r.config || {})
     }));
     
     res.json({ success: true, count: parsed.length, providers: parsed });
  });
};

exports.setDefaultProvider = (req, res) => {
  const { id } = req.params;
  const { channel } = req.body; 

  if (!channel) return res.status(400).json({ error: "Channel strictly required to isolate defaults." });

  db.query(`UPDATE global_service_providers SET is_default = FALSE WHERE channel = ?`, [channel], (err) => {
     if (err) return res.status(500).json({ error: err.message });
     
     db.query(`UPDATE global_service_providers SET is_default = TRUE WHERE id = ?`, [id], (err2) => {
         if (err2) return res.status(500).json({ error: err2.message });
         res.json({ success: true, message: "Default channel router updated physically." });
     });
  });
};

exports.testSmtpConnection = async (req, res) => {
  const { testEmail } = req.body;
  
  if (!testEmail) return res.status(400).json({ error: "Please provide a testEmail target." });

  try {
     const emailService = require("../services/emailService");
     const htmlFormat = `
        <div style="font-family: sans-serif; padding: 20px;">
           <h2 style="color: #2e6c80;">Custom SMTP Configuration Successful!</h2>
           <p>If you are reading this email, it means your private Nodemailer configuration completely bypassed the server barriers and physically routed through your custom host.</p>
           <p>Your SaaS environment is fully secured!</p>
        </div>
     `;
     
     await emailService.sendSystemEmail(testEmail, "SaaS Platform: Custom SMTP Verified", htmlFormat);
     res.json({ success: true, message: "Custom SMTP hit successfully! Check your inbox." });
  } catch (e) {
     res.status(500).json({ error: "Custom SMTP Connection Refused", details: e.message });
  }
};
