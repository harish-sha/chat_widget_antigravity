const db = require("../db");

exports.getSettings = (req, res) => {
  const { widgetId } = req.params;
  const sql = `SELECT * FROM widget_ai_settings WHERE widget_id = ?`;
  db.query(sql, [widgetId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (!result.length) return res.json({ settings: null });
    res.json({ settings: result[0] });
  });
};

exports.updateAdminSettings = (req, res) => {
  const { widgetId } = req.params;
  const { provider, api_key, model, temperature, max_tokens, fallback_message } = req.body;

  const sql = `
    INSERT INTO widget_ai_settings 
      (widget_id, provider, api_key, model, temperature, max_tokens, fallback_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      provider = ?, api_key = ?, model = ?, temperature = ?, max_tokens = ?, fallback_message = ?
  `;

  const values = [
    widgetId,
    provider || 'openai',
    api_key || null,
    model || 'gpt-3.5-turbo',
    temperature ?? 0.70,
    max_tokens || 500,
    fallback_message || null,

    provider || 'openai',
    api_key || null,
    model || 'gpt-3.5-turbo',
    temperature ?? 0.70,
    max_tokens || 500,
    fallback_message || null
  ];

  db.query(sql, values, (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ success: true, message: "Admin AI Settings secured and updated" });
  });
};

exports.updateAgentSettings = (req, res) => {
  const { widgetId } = req.params;
  const { is_enabled, system_prompt, tone, grammar_mode } = req.body;

  const sql = `
    INSERT INTO widget_ai_settings 
      (widget_id, is_enabled, system_prompt, tone, grammar_mode)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      is_enabled = ?, system_prompt = ?, tone = ?, grammar_mode = ?
  `;

  const values = [
    widgetId,
    is_enabled || false,
    system_prompt || null,
    tone || 'professional',
    grammar_mode || false,

    is_enabled || false,
    system_prompt || null,
    tone || 'professional',
    grammar_mode || false
  ];

  db.query(sql, values, (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ success: true, message: "Agent Preferences securely updated" });
  });
};

exports.getKnowledge = (req, res) => {
  const { widgetId } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { type } = req.query;

  let whereClause = `WHERE widget_id = ?`;
  const params = [widgetId];

  if (type) {
    whereClause += ` AND type = ?`;
    params.push(type);
  }

  const countSql = `SELECT COUNT(*) AS total FROM ai_knowledge_base ${whereClause}`;

  db.query(countSql, params, (err, countResult) => {
    if (err) return res.status(500).json({ error: err });

    const total = countResult[0].total;
    const sql = `
      SELECT * FROM ai_knowledge_base
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    db.query(sql, [...params, limit, offset], (err, results) => {
      if (err) return res.status(500).json({ error: err });
      res.json({
        page,
        limit,
        count: results.length,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
        knowledge: results
      });
    });
  });
};

exports.addKnowledge = (req, res) => {
  const { widgetId } = req.params;
  const { type, content } = req.body;

  if (!content) return res.status(400).json({ error: "Content is required" });

  const sql = `INSERT INTO ai_knowledge_base (widget_id, type, content) VALUES (?, ?, ?)`;
  db.query(sql, [widgetId, type || 'text', content], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ success: true, id: result.insertId });
  });
};

exports.deleteKnowledge = (req, res) => {
  const { id } = req.params;
  const sql = `DELETE FROM ai_knowledge_base WHERE id = ?`;
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ success: true });
  });
};

const OpenAI = require("openai");

exports.agentAssist = (req, res) => {
  const { widgetId } = req.params;
  const { question, context_instruction } = req.body;

  if (!question) return res.status(400).json({ error: "Question parameter missing" });

  const settingsSql = `SELECT * FROM widget_ai_settings WHERE widget_id = ?`;
  db.query(settingsSql, [widgetId], (err, settingsResult) => {
    if (err) return res.status(500).json({ error: err });
    if (!settingsResult.length || !settingsResult[0].api_key) {
      return res.status(400).json({ error: "AI not configured for this widget or missing API key." });
    }

    const settings = settingsResult[0];

    const kbSql = `SELECT content FROM ai_knowledge_base WHERE widget_id = ? AND status = 'active'`;
    db.query(kbSql, [widgetId], async (kbErr, kbResult) => {
      let kbContext = "";
      if (!kbErr && kbResult.length) {
        kbContext = kbResult.map(k => k.content).join("\n\n");
      }

      const messages = [];
      let sysPrompt = "You are an internal AI assistant helping a human agent. Do not address an external user.";
      if (context_instruction) sysPrompt += `\nSpecial instructions: ${context_instruction}`;
      if (kbContext) sysPrompt += `\n\nVerified Knowledge Context:\n${kbContext}`;

      messages.push({ role: "user", content: question });

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

        const logSql = `
           INSERT INTO ai_metrics_log 
             (widget_id, conversation_id, provider, model, temperature, latency_ms, prompt_tokens, completion_tokens, total_tokens, is_fallback)
           VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 0)
         `;
         db.query(logSql, [
           widgetId, settings.provider || 'openai', settings.model || 'gpt-3.5-turbo', settings.temperature ?? 0.7,
           botResponse.metrics.latency, botResponse.metrics.promptTokens, botResponse.metrics.completionTokens, botResponse.metrics.totalTokens
         ]);

        res.json({ success: true, answer: botResponse.answer });
      } catch (e) {
         const logErrSql = `
             INSERT INTO ai_metrics_log 
               (widget_id, conversation_id, provider, model, temperature, latency_ms, is_fallback, error_message)
             VALUES (?, NULL, ?, ?, ?, 0, 1, ?)
          `;
          db.query(logErrSql, [
             widgetId, settings.provider || 'openai', settings.model || 'gpt-3.5-turbo', settings.temperature ?? 0.7, e.message
          ]);
        res.status(500).json({ error: e.message });
      }
    });
  });
};
