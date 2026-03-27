const db = require("../db");
const { v4: uuidv4 } = require("uuid");

exports.createConversation = (req, res) => {
  const { widgetId, sessionId } = req.body;
  const id = uuidv4();

  const sql = `INSERT INTO conversations (id, widget_id, session_id) VALUES (?, ?, ?)`;
  db.query(sql, [id, widgetId, sessionId], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ conversationId: id });
  });
};

exports.getConversations = (req, res) => {
  const { widgetId } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { status } = req.query;

  let whereClause = `WHERE widget_id = ?`;
  const params = [widgetId];

  if (status) {
    whereClause += ` AND status = ?`;
    params.push(status);
  }

  const statsSql = `
    SELECT 
      COALESCE(SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END), 0) AS openCount,
      COALESCE(SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END), 0) AS resolvedCount
    FROM conversations
    WHERE widget_id = ?
  `;

  db.query(statsSql, [widgetId], (err, statsResult) => {
    if (err) return res.status(500).json({ error: err });

    const openCount = Number(statsResult[0]?.openCount) || 0;
    const resolvedCount = Number(statsResult[0]?.resolvedCount) || 0;

    const countSql = `SELECT COUNT(*) AS total FROM conversations ${whereClause}`;

    db.query(countSql, params, (err, countResult) => {
      if (err) return res.status(500).json({ error: err });

      const total = countResult[0].total;
      const sql = `
        SELECT *
        FROM conversations
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      db.query(sql, [...params, limit, offset], (err, result) => {
        if (err) return res.status(500).json({ error: err });

        res.json({
          page,
          limit,
          count: result.length,
          total,
          openCount,
          resolvedCount,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
          conversations: result,
        });
      });
    });
  });
};

exports.resolveConversation = (req, res) => {
  const { conversationId, resolvedBy, agentId, note } = req.body;

  const updateSql = `
    UPDATE conversations
    SET 
      status = 'resolved',
      resolved_by = ?,
      resolved_at = NOW(),
      agent_id = ?,
      resolve_note = ?
    WHERE id = ?
  `;

  db.query(
    updateSql,
    [resolvedBy || "agent", agentId || null, note || null, conversationId],
    (err) => {
      if (err) return res.status(500).json({ error: err });

      const messageSql = `
        INSERT INTO messages (conversation_id, sender, message, message_type)
        VALUES (?, 'system', 'Conversation resolved', 'system')
      `;

      db.query(messageSql, [conversationId], (err2) => {
        if (err2) return res.status(500).json({ error: err2 });
        res.json({ success: true, message: "Conversation marked as resolved" });
      });
    }
  );
};

exports.toggleBotStatus = (req, res) => {
  const { id } = req.params;
  const { botActive } = req.body;
  const sql = `UPDATE conversations SET bot_active = ? WHERE id = ?`;
  db.query(sql, [botActive ? 1 : 0, id], (err) => {
    if (err) return res.status(500).json({ error: err });

    const msgSql = `
      INSERT INTO messages (conversation_id, sender, message, message_type)
      VALUES (?, 'system', ?, 'system')
    `;
    const sysMsg = botActive ? 'AI Assistant is now enabled.' : 'AI Assistant is now disabled by an Agent.';
    
    db.query(msgSql, [id, sysMsg], (err2) => {
      res.json({ success: true, botActive, message: "Bot status updated" });
    });
  });
};
