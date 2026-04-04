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
