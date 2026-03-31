const db = require("../db");
const OpenAI = require("openai");

async function triggerAIResponse(conversationId, widgetId, userMessage) {
  const settingsSql = `SELECT * FROM widget_ai_settings WHERE widget_id = ? AND is_enabled = TRUE`;

  db.query(settingsSql, [widgetId], (err, settingsResult) => {
    if (err || !settingsResult.length) return;

    const settings = settingsResult[0];
    if (!settings.api_key) return;

    const kbSql = `SELECT content, embedding FROM ai_knowledge_base WHERE widget_id = ? AND status = 'active'`;
    db.query(kbSql, [widgetId], async (err, kbResult) => {
      let kbContext = "";
      if (!err && kbResult.length > 0) {
        if (settings.api_key) {
          try {
            const aiService = require("../services/aiService");
            const vectorMath = require("../utils/vectorMath");
            const qVector = await aiService.embedText(settings.provider, settings.api_key, userMessage);

            const scored = kbResult.map(row => {
              let score = 0;
              if (row.embedding) {
                const rowVector = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
                score = vectorMath.cosineSimilarity(qVector, rowVector);
              }
              return { content: row.content, score };
            });

            scored.sort((a, b) => b.score - a.score);
            kbContext = scored.slice(0, 4).map(s => s.content).join("\n\n");
          } catch (e) {
            console.error("Bot RAG Error: ", e.message);
          }
        }

        if (!kbContext) {
          kbContext = kbResult.slice(0, 4).map(k => k.content).join("\n\n");
        }
      }

      const historySql = `
        SELECT sender, message 
        FROM (
          SELECT sender, message, created_at FROM messages 
          WHERE conversation_id = ? AND message_type = 'text' 
          ORDER BY created_at DESC LIMIT 15
        ) sub
        ORDER BY created_at ASC
      `;

      db.query(historySql, [conversationId], async (err, historyResult) => {
        if (err) return;

        const messages = [];
        let sysPrompt = settings.system_prompt || "You are a helpful assistant.";
        sysPrompt += `\nYour tone should be: ${settings.tone}.`;
        if (settings.grammar_mode) sysPrompt += `\nPlease elegantly fix minor grammatical errors in your response context.`;
        if (kbContext) {
          sysPrompt += `\n\nUse the following verified knowledge context to answer questions:\n${kbContext}`;
        }

        for (let msg of historyResult) {
          if (msg.message && typeof msg.message === 'string') {
            const role = (msg.sender === 'bot' || msg.sender === 'agent') ? 'assistant' : 'user';

            if (messages.length > 0 && messages[messages.length - 1].role === role) {
              messages[messages.length - 1].content += "\n" + msg.message;
            } else {
              messages.push({ role, content: msg.message });
            }
          }
        }

        if (messages.length === 0 || messages[messages.length - 1].content !== userMessage) {
          if (messages.length > 0 && messages[messages.length - 1].role === "user") {
            messages[messages.length - 1].content += "\n" + userMessage;
          } else {
            messages.push({ role: "user", content: userMessage });
          }
        }

        try {
          const aiService = require("../services/aiService");
          const botResponse = await aiService.generate({
            provider: settings.provider,
            apiKey: settings.api_key,
            model: settings.model,
            temperature: settings.temperature,
            maxTokens: settings.max_tokens,
            systemPrompt: sysPrompt,
            messages: messages
          });

          if (botResponse && botResponse.answer) {
            const insertReplySql = `
              INSERT INTO messages (conversation_id, sender, message, message_type)
              VALUES (?, 'bot', ?, 'text')
             `;
            db.query(insertReplySql, [conversationId, botResponse.answer]);

            const logSql = `
               INSERT INTO ai_metrics_log 
                 (widget_id, conversation_id, provider, model, temperature, latency_ms, prompt_tokens, completion_tokens, total_tokens, is_fallback)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
             `;
            db.query(logSql, [
              widgetId, conversationId,
              settings.provider || 'openai', settings.model || 'gpt-3.5-turbo', settings.temperature ?? 0.7,
              botResponse.metrics.latency, botResponse.metrics.promptTokens, botResponse.metrics.completionTokens, botResponse.metrics.totalTokens
            ]);
          }

        } catch (e) {
          console.error("AI Gen Error:", e.message);
          const fallback = settings.fallback_message || `AI failed to respond: ${e.message}`;
          const errSql = `INSERT INTO messages (conversation_id, sender, message, message_type) VALUES (?, 'system', ?, 'system')`;
          db.query(errSql, [conversationId, fallback]);

          const logErrSql = `
             INSERT INTO ai_metrics_log 
               (widget_id, conversation_id, provider, model, temperature, latency_ms, is_fallback, error_message)
             VALUES (?, ?, ?, ?, ?, 0, 1, ?)
          `;
          db.query(logErrSql, [
            widgetId, conversationId,
            settings.provider || 'openai', settings.model || 'gpt-3.5-turbo', settings.temperature ?? 0.7,
            e.message
          ]);
        }
      });
    });
  });
}

exports.sendMessage = (req, res) => {
  const { conversationId, sender, message, messageType, meta, mediaUrl, fileName, fileSize } = req.body;

  if (!["user", "agent", "bot", "system"].includes(sender)) {
    return res.status(400).json({ error: "Invalid sender" });
  }

  const insertUserSql = `
    INSERT INTO messages (conversation_id, sender, message, message_type, media_url, file_name, file_size, meta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    insertUserSql,
    [conversationId, sender, message || null, messageType || "text", mediaUrl || null, fileName || null, fileSize || null, meta ? JSON.stringify(meta) : null],
    (err) => {
      if (err) return res.status(500).json({ error: err });

      if (sender === "user" && messageType === "text" && message) {
        const convSql = `SELECT widget_id, bot_active FROM conversations WHERE id = ?`;
        db.query(convSql, [conversationId], (err, convResult) => {
          if (!err && convResult.length > 0) {
            const { widget_id, bot_active } = convResult[0];
            if (bot_active) {
              triggerAIResponse(conversationId, widget_id, message);
            }
          }
        });
      }

      res.json({ success: true });
    }
  );
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

exports.syncMessages = (req, res) => {
  const { conversationId } = req.params;
  const afterId = Number(req.query.afterId) || 0;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 100;
  const offset = (page - 1) * limit;

  const countSql = `SELECT COUNT(*) AS total FROM messages WHERE conversation_id = ? AND id > ?`;

  db.query(countSql, [conversationId, afterId], (err, countResult) => {
    if (err) return res.status(500).json({ error: err });

    const total = countResult[0].total;
    const sql = `
      SELECT * FROM messages 
      WHERE conversation_id = ? AND id > ? 
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `;

    db.query(sql, [conversationId, afterId, limit, offset], (err, results) => {
      if (err) return res.status(500).json({ error: err });

      const convSql = `SELECT bot_active FROM conversations WHERE id = ?`;
      db.query(convSql, [conversationId], (err, convResult) => {
        if (err) return res.status(500).json({ error: err });

        const aiStatus = convResult.length > 0 ? !!convResult[0].bot_active : false;

        res.json({
          success: true,
          aiStatus: aiStatus,
          page,
          limit,
          count: results.length,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
          messages: results
        });
      });
    });
  });
};
