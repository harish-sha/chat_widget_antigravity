const db = require("../db");
const bcrypt = require("bcrypt");

exports.getProfile = (req, res) => {
  const userId = req.user.id;
  db.query(`SELECT id, name, email, google_id, role, widget_id, profile_pic_url, created_at FROM users WHERE id = ?`, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!results.length) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, profile: results[0] });
  });
};

exports.updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { name, profile_pic_url, password } = req.body;

  try {
    let sql = `UPDATE users SET name = ?, profile_pic_url = ?`;
    let params = [name, profile_pic_url];

    // If user submits a new password string, encrypt it
    if (password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password, 10);
      sql += `, password_hash = ?`;
      params.push(hash);
    }

    sql += ` WHERE id = ?`;
    params.push(userId);

    db.query(sql, params, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: "Profile updated successfully" });
    });
  } catch (e) {
    res.status(500).json({ error: "Profile update failed" });
  }
};
