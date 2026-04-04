const db = require("../db");
const { v4: uuidv4 } = require("uuid");

exports.submitForm = (req, res) => {
  const { widgetId, conversationId, answers, meta } = req.body;
  const sessionId = req.headers["x-session-id"] || uuidv4();
  const sql = `SELECT config FROM widgets WHERE widget_id = ?`;

  db.query(sql, [widgetId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (!result.length) return res.status(400).json({ error: "Widget not found" });

    const configRaw = result[0].config;
    let config;
    try {
      config = typeof configRaw === "string" ? JSON.parse(configRaw) : configRaw;
    } catch (e) {
      return res.status(500).json({ error: "Invalid JSON in DB" });
    }

    const formVersion = config?.surveyForm?.formVersion || 1;
    const insertSql = `
      INSERT INTO form_submissions 
      (widget_id, form_version, answers, session_id, conversation_id, meta)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
      insertSql,
      [widgetId, formVersion, JSON.stringify(answers), sessionId, conversationId || null, JSON.stringify(meta || {})],
      (err) => {
        if (err) return res.status(500).json({ error: err });

        // Physically trigger the master Alert Dispatcher
        const alertDispatcher = require("../services/alertDispatcher");
        alertDispatcher.fire(widgetId, "new_lead_/_form_submission", { answers, conversationId });

        if (conversationId) {
          const messageSql = `
            INSERT INTO messages (conversation_id, sender, message, message_type)
            VALUES (?, 'user', ?, 'form_submission')
          `;
          db.query(messageSql, [conversationId, JSON.stringify(answers)], (msgErr) => {
            if (msgErr) console.error("Error saving form message:", msgErr);
            res.json({ success: true, sessionId, message: "Form submitted and attached to conversation" });
          });
        } else {
          res.json({ success: true, sessionId, message: "Form submitted" });
        }
      }
    );
  });
};

exports.getSubmissionsByVersion = (req, res) => {
  const { widgetId, version } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { fromDate, toDate, device, conversationId } = req.query;

  let whereClause = `WHERE widget_id = ? AND form_version = ?`;
  const params = [widgetId, version];

  if (fromDate) {
    whereClause += ` AND created_at >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    whereClause += ` AND created_at <= ?`;
    params.push(toDate);
  }
  if (device) {
    whereClause += ` AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.device')) = ?`;
    params.push(device);
  }
  if (conversationId) {
    whereClause += ` AND conversation_id = ?`;
    params.push(conversationId);
  }

  const countSql = `SELECT COUNT(*) AS total FROM form_submissions ${whereClause}`;

  db.query(countSql, params, (err, countResult) => {
    if (err) return res.status(500).json({ error: err });

    const total = countResult[0].total;
    const sql = `
      SELECT id, answers, meta, session_id, conversation_id, created_at
      FROM form_submissions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    db.query(sql, [...params, limit, offset], (err, submissions) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ page, limit, count: submissions.length, total, submissions });
    });
  });
};

exports.getAllSubmissions = (req, res) => {
  const { widgetId } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { fromDate, toDate, device, conversationId } = req.query;

  let whereClause = `WHERE widget_id = ?`;
  const params = [widgetId];

  if (fromDate) {
    whereClause += ` AND created_at >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    whereClause += ` AND created_at <= ?`;
    params.push(toDate);
  }
  if (device) {
    whereClause += ` AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.device')) = ?`;
    params.push(device);
  }
  if (conversationId) {
    whereClause += ` AND conversation_id = ?`;
    params.push(conversationId);
  }

  const countSql = `SELECT COUNT(*) AS total FROM form_submissions ${whereClause}`;

  db.query(countSql, params, (err, countResult) => {
    if (err) return res.status(500).json({ error: err });

    const total = countResult[0].total;
    const sql = `
      SELECT id, answers, meta, session_id, conversation_id, created_at
      FROM form_submissions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    db.query(sql, [...params, limit, offset], (err, submissions) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ page, limit, count: submissions.length, total, submissions });
    });
  });
};

exports.getFormVersions = (req, res) => {
  const { widgetId } = req.params;
  const sql = `SELECT DISTINCT form_version FROM form_versions WHERE widget_id = ? ORDER BY form_version DESC`;
  db.query(sql, [widgetId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ versions: result.map((r) => r.form_version) });
  });
};
