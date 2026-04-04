const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing Token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "SUPER_SECRET_KEY");
    req.user = decoded; // Contains id, email, widgetId, role
    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized: Invalid or Expired Token" });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: "Forbidden: Admin privileges strictly required" });
  }
};

module.exports = { authMiddleware, adminMiddleware };
