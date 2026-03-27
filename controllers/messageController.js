const db = require("../db");

exports.sendMessage = (req, res) => {
  const { conversationId, sender, message, messageType, meta } = req.body;

  if (!["user", "agent", "bot", "system"].includes(sender)) {
    return res.status(400).json({ error: "Invalid sender" });
  }

  const insertUserSql = `
    INSERT INTO messages (conversation_id, sender, message, message_type)
    VALUES (?, ?, ?, ?)
  `;

  db.query(insertUserSql, [conversationId, sender, message, messageType], (err) => {
    if (err) return res.status(500).json({ error: err });

    if (sender === "user") {
      let botReply = null;
      if (meta?.type === "starter") botReply = meta?.answer;
      if (messageType === "quick_reply") botReply = meta?.replyValue;

      if (botReply) {
        const botSql = `
          INSERT INTO messages (conversation_id, sender, message, message_type)
          VALUES (?, 'bot', ?, 'text')
        `;
        db.query(botSql, [conversationId, botReply]);
      }
    }
    res.json({ success: true });
  });
};

exports.sendStarterMessage = (req, res) => {
  const { conversationId, question, answer } = req.body;
  const sql = `
    INSERT INTO messages (conversation_id, sender, message)
    VALUES 
    (?, 'user', ?),
    (?, 'bot', ?)
  `;
  db.query(sql, [conversationId, question, conversationId, answer], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ success: true });
  });
};

exports.getMessages = (req, res) => {
  const { conversationId } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const countSql = `SELECT COUNT(*) AS total FROM messages WHERE conversation_id = ?`;

  db.query(countSql, [conversationId], (err, countResult) => {
    if (err) return res.status(500).json({ error: err });

    const total = countResult[0].total;
    const sql = `
      SELECT *
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    db.query(sql, [conversationId, limit, offset], (err, result) => {
      if (err) return res.status(500).json({ error: err });

      res.json({
        page,
        limit,
        count: result.length,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
        messages: result.reverse(),
      });
    });
  });
};
