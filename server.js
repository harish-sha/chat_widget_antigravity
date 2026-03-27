const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/* SAVE WIDGET CONFIG */
app.post("/widget/save", (req, res) => {
  const { widgetId, config } = req.body;

  const sql = `
 INSERT INTO widgets (widget_id, config)
 VALUES (?, ?)
 ON DUPLICATE KEY UPDATE config = ?
 `;

  const jsonConfig = JSON.stringify(config);

  db.query(sql, [widgetId, jsonConfig, jsonConfig], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err });
    }
    const version = config?.surveyForm?.formVersion;
    if (version) {
      const versionSql = `
        INSERT IGNORE INTO form_versions (widget_id, form_version)
        VALUES (?, ?)
      `;

      db.query(versionSql, [widgetId, version]);
    }

    res.json({
      success: true,
      message: "Widget saved",
    });
  });
});

/* GET WIDGET CONFIG */

app.get("/widget/config/:widgetId", (req, res) => {
  const widgetId = req.params.widgetId;

  const sql = `
 SELECT config FROM widgets
 WHERE widget_id = ?
 `;

  db.query(sql, [widgetId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err });
    }

    if (result.length === 0) {
      return res.json({ config: null });
    }

    const config = result[0].config;

    res.json({
      config,
    });
  });
});

const { v4: uuidv4 } = require("uuid");

app.post("/form/submit", (req, res) => {
  const { widgetId, answers, meta } = req.body;

  const sessionId = req.headers["x-session-id"] || uuidv4();

  // 1. Get widget config
  const sql = `SELECT config FROM widgets WHERE widget_id = ?`;

  db.query(sql, [widgetId], (err, result) => {
    if (err) return res.status(500).json({ error: err });

    if (!result.length) {
      return res.status(400).json({ error: "Widget not found" });
    }

    // const config = JSON.parse(result[0].config);
    const configRaw = result[0].config;

    let config;

    try {
      config =
        typeof configRaw === "string" ? JSON.parse(configRaw) : configRaw;
    } catch (e) {
      return res.status(500).json({ error: "Invalid JSON in DB" });
    }

    const formVersion = config?.surveyForm?.formVersion || 1;

    // 2. Save submission
    const insertSql = `
      INSERT INTO form_submissions 
      (widget_id, form_version, answers, session_id, meta)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
      insertSql,
      [
        widgetId,
        formVersion,
        JSON.stringify(answers),
        sessionId,
        JSON.stringify(meta || {}),
      ],
      (err) => {
        if (err) return res.status(500).json({ error: err });

        res.json({
          success: true,
          sessionId,
        });
      },
    );
  });
});

app.get("/form/submissions/:widgetId/:version", (req, res) => {
  const { widgetId, version } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const { fromDate, toDate, device } = req.query;

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

  const countSql = `
    SELECT COUNT(*) AS total
    FROM form_submissions
    ${whereClause}
  `;

  db.query(countSql, params, (err, countResult) => {
    if (err) return res.status(500).json({ error: err });

    const total = countResult[0].total;

    const sql = `
      SELECT id, answers, meta, session_id, created_at
      FROM form_submissions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    db.query(sql, [...params, limit, offset], (err, submissions) => {
      if (err) return res.status(500).json({ error: err });

      res.json({
        page,
        limit,
        count: submissions.length,
        total,
        submissions,
      });
    });
  });
});

app.get("/form/submissions/:widgetId", (req, res) => {
  const { widgetId } = req.params;

  const sql = `
    SELECT * FROM form_submissions
    WHERE widget_id = ?
    ORDER BY created_at DESC
  `;

  db.query(sql, [widgetId], (err, result) => {
    if (err) return res.status(500).json({ error: err });

    res.json({
      submissions: result,
    });
  });
});

app.get("/form/versions/:widgetId", (req, res) => {
  const { widgetId } = req.params;

  const sql = `
    SELECT DISTINCT form_version
    FROM form_versions
    WHERE widget_id = ?
    ORDER BY form_version DESC
  `;

  db.query(sql, [widgetId], (err, result) => {
    if (err) return res.status(500).json({ error: err });

    res.json({
      versions: result.map((r) => r.form_version),
    });
  });
});

// conversations
// app.post("/conversation/create", (req, res) => {
//   const { widgetId, sessionId } = req.body;
//   const id = uuidv4();

//   const sql = `
//     INSERT INTO conversations (id, widget_id, session_id)
//     VALUES (?, ?, ?)
//   `;

//   db.query(sql, [id, widgetId, sessionId], (err) => {
//     if (err) return res.status(500).json({ error: err });

//     res.json({ conversationId: id });
//   });
// });

app.post("/conversation/create", (req, res) => {
  const { widgetId, sessionId } = req.body;
  const id = uuidv4();

  const sql = `
    INSERT INTO conversations (id, widget_id, session_id)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [id, widgetId, sessionId], (err) => {
    if (err) return res.status(500).json({ error: err });

    res.json({ conversationId: id });
  });
});

// app.post("/messages/send", (req, res) => {
//   const {
//     conversationId,
//     sender,
//     message,
//     messageType,
//     mediaUrl,
//     fileName,
//     fileSize,
//   } = req.body;

//   if (!["user", "agent", "bot", "system"].includes(sender)) {
//     return res.status(400).json({ error: "Invalid sender" });
//   }

//   const sql = `
//     INSERT INTO messages
//     (conversation_id, sender, message, message_type, media_url, file_name, file_size)
//     VALUES (?, ?, ?, ?, ?, ?, ?)
//   `;

//   db.query(
//     sql,
//     [
//       conversationId,
//       sender,
//       message || null,
//       messageType || "text",
//       mediaUrl || null,
//       fileName || null,
//       fileSize || null,
//     ],
//     (err) => {
//       if (err) return res.status(500).json({ error: err });

//       res.json({ success: true });
//     },
//   );
// });

app.post("/messages/send", (req, res) => {
  const { conversationId, sender, message, messageType, meta } = req.body;

  if (!["user", "agent", "bot", "system"].includes(sender)) {
    return res.status(400).json({ error: "Invalid sender" });
  }

  // 1. Save user/agent message
  const insertUserSql = `
    INSERT INTO messages (conversation_id, sender, message, message_type)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    insertUserSql,
    [conversationId, sender, message, messageType],
    (err) => {
      if (err) return res.status(500).json({ error: err });

      // 2. Handle bot logic ONLY for user
      if (sender === "user") {
        let botReply = null;

        if (meta?.type === "starter") {
          botReply = meta?.answer;
        }

        if (messageType === "quick_reply") {
          botReply = meta?.replyValue;
        }

        if (botReply) {
          const botSql = `
          INSERT INTO messages (conversation_id, sender, message, message_type)
          VALUES (?, 'bot', ?, 'text')
        `;

          db.query(botSql, [conversationId, botReply]);
        }
      }

      res.json({ success: true });
    },
  );
});

app.post("/messages/starter", (req, res) => {
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
});

// app.get("/messages/:conversationId", (req, res) => {
//   const { conversationId } = req.params;

//   const sql = `
//     SELECT * FROM messages
//     WHERE conversation_id = ?
//     ORDER BY created_at ASC
//   `;

//   db.query(sql, [conversationId], (err, result) => {
//     if (err) return res.status(500).json({ error: err });

//     res.json({ messages: result });
//   });
// });

app.get("/messages/:conversationId", (req, res) => {
  const { conversationId } = req.params;

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM messages
    WHERE conversation_id = ?
  `;

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
});

// app.get("/conversations/:widgetId", (req, res) => {
//   const { widgetId } = req.params;
//   const { status } = req.query; // optional

//   let sql = `
//     SELECT * FROM conversations
//     WHERE widget_id = ?
//   `;

//   const params = [widgetId];

//   if (status) {
//     sql += ` AND status = ?`;
//     params.push(status);
//   }

//   sql += ` ORDER BY created_at DESC`;

//   db.query(sql, params, (err, result) => {
//     if (err) return res.status(500).json({ error: err });

//     res.json({ conversations: result });
//   });
// });



app.get("/conversations/:widgetId", (req, res) => {
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

  const countSql = `
    SELECT COUNT(*) AS total
    FROM conversations
    ${whereClause}
  `;

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
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
        conversations: result,
      });
    });
  });
});

app.post("/messages/agent-reply", (req, res) => {
  const { conversationId, message } = req.body;

  const sql = `
    INSERT INTO messages (conversation_id, sender, message)
    VALUES (?, 'agent', ?)
  `;

  db.query(sql, [conversationId, message], (err) => {
    if (err) return res.status(500).json({ error: err });

    res.json({ success: true });
  });
});

app.post("/conversation/resolve", (req, res) => {
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

        res.json({
          success: true,
          message: "Conversation marked as resolved",
        });
      });
    },
  );
});

app.listen(8000, () => {
  console.log("Server running on port 8000");
});
