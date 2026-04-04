const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { v4: uuidv4 } = require("uuid");
const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID");

const JWT_SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY";

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, widgetId: user.widget_id, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  try {
    const hash = await bcrypt.hash(password, 10);
    const widgetId = uuidv4(); // Unique tenant ID for the new user!

    const sql = `INSERT INTO users (name, email, password_hash, widget_id) VALUES (?, ?, ?, ?)`;
    db.query(sql, [name, email, hash, widgetId], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "Email is already registered" });
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, message: "User registered securely", widgetId });
    });
  } catch (e) {
    res.status(500).json({ error: "Registration failed securely" });
  }
};

exports.login = (req, res) => {
  const { email, password } = req.body;

  db.query(`SELECT * FROM users WHERE email = ?`, [email], async (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!result.length) return res.status(401).json({ error: "Invalid credentials" });

    const user = result[0];
    if (!user.is_active) return res.status(403).json({ error: "Account suspended by System Administrator" });
    if (!user.password_hash) return res.status(401).json({ error: "Please log in via Google. No password set." });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    res.json({
      success: true,
      token: generateToken(user),
      user: { name: user.name, email: user.email, role: user.role, widgetId: user.widget_id, pic: user.profile_pic_url }
    });
  });
};

exports.googleLogin = async (req, res) => {
  const { credential } = req.body; // Token from Google Sign-In React Provider

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name;
    const pic = payload.picture;

    db.query(`SELECT * FROM users WHERE email = ?`, [email], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      if (result.length > 0) {
        const user = result[0];
        if (!user.is_active) return res.status(403).json({ error: "Account suspended by Admin" });

        db.query(`UPDATE users SET profile_pic_url = ?, google_id = ? WHERE email = ?`, [pic, payload.sub, email]);
        return res.json({
          success: true,
          token: generateToken(user),
          user: { name: user.name, email: user.email, role: user.role, widgetId: user.widget_id, pic: pic }
        });
      } else {
        // Auto-Registration via Google OAuth
        const widgetId = uuidv4();
        const sql = `INSERT INTO users (name, email, google_id, profile_pic_url, widget_id) VALUES (?, ?, ?, ?, ?)`;
        db.query(sql, [name, email, payload.sub, pic, widgetId], (err2, res2) => {
          if (err2) return res.status(500).json({ error: err2.message });

          const newUser = { id: res2.insertId, email, widget_id: widgetId, role: 'user' };
          res.json({
            success: true,
            token: generateToken(newUser),
            user: { name, email, role: 'user', widgetId, pic }
          });
        });
      }
    });

  } catch (e) {
    res.status(401).json({ error: "Invalid Google Token received on Backend", details: e.message });
  }
};
