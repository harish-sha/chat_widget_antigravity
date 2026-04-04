const db = require("../db");

exports.getAllSettings = (req, res) => {
  const sql = `
    SELECT widget_id, provider, model, temperature, max_tokens, 
           fallback_message, is_enabled, system_prompt, tone, grammar_mode 
    FROM widget_ai_settings
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ success: true, count: results.length, settings: results });
  });
};

exports.getSettings = (req, res) => {
  const { widgetId } = req.params;
  const sql = `SELECT * FROM widget_ai_settings WHERE widget_id = ?`;
  db.query(sql, [widgetId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (!result.length) return res.json({ settings: null });

    const settings = { ...result[0], api_key: null }; // Mask key for security

    res.json({ settings });
  });
};

exports.updateAdminSettings = (req, res) => {
  const { widgetId } = req.params;
  const { provider, api_key, model, temperature, max_tokens } = req.body;

  const sql = `
    INSERT INTO widget_ai_settings 
      (widget_id, provider, api_key, model, temperature, max_tokens)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      provider = ?, api_key = ?, model = ?, temperature = ?, max_tokens = ?
  `;

  const values = [
    widgetId,
    provider || 'openai',
    api_key || null,
    model || 'gpt-3.5-turbo',
    temperature ?? 0.70,
    max_tokens || 500,

    provider || 'openai',
    api_key || null,
    model || 'gpt-3.5-turbo',
    temperature ?? 0.70,
    max_tokens || 500
  ];

  db.query(sql, values, (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ success: true, message: "Admin AI Settings secured and updated" });
  });
};

exports.updateAgentSettings = (req, res) => {
  const { widgetId } = req.params;
  const { is_enabled, system_prompt, tone, grammar_mode, fallback_message } = req.body;

  const sql = `
    INSERT INTO widget_ai_settings 
      (widget_id, is_enabled, system_prompt, tone, grammar_mode, fallback_message)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      is_enabled = ?, system_prompt = ?, tone = ?, grammar_mode = ?, fallback_message = ?
  `;

  const values = [
    widgetId,
    is_enabled || false,
    system_prompt || null,
    tone || 'professional',
    grammar_mode || false,
    fallback_message || null,

    is_enabled || false,
    system_prompt || null,
    tone || 'professional',
    grammar_mode || false,
    fallback_message || null
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
      SELECT id, widget_id, type, content, status, created_at, file_name 
      FROM ai_knowledge_base
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

const pdfParse = require("pdf-parse");
const xlsx = require("xlsx");

const chunkText = (text, maxLength = 1000) => {
  const words = text.split(" ");
  const chunks = [];
  let currentChunk = "";

  for (let w of words) {
    if ((currentChunk.length + w.length) > maxLength) {
      chunks.push(currentChunk.trim());
      currentChunk = w + " ";
    } else {
      currentChunk += w + " ";
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
};

exports.addKnowledge = async (req, res) => {
  const { widgetId } = req.params;
  const body = req.body || {};
  const { type } = body;
  let textContent = body.content || "";
  let fileName = null;

  try {
    const settingsSql = `SELECT provider, api_key FROM widget_ai_settings WHERE widget_id = ?`;
    db.query(settingsSql, [widgetId], async (err, settingsResult) => {
      if (err) return res.status(500).json({ error: err.message });
      const settings = settingsResult[0] || {};

      if (req.file) {
        fileName = req.file.originalname;
        if (req.file.mimetype === "application/pdf") {
          const pdfData = await pdfParse(req.file.buffer);
          textContent = pdfData.text;
        } else if (req.file.mimetype.includes("spreadsheet") || fileName.endsWith(".xlsx") || fileName.endsWith(".csv")) {
          const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
          textContent = xlsx.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
        } else {
          textContent = req.file.buffer.toString("utf8");
        }
      }

      if (!textContent || textContent.trim().length === 0) {
        return res.status(400).json({ error: "No valid text content found to embed." });
      }

      const aiService = require("../services/aiService");
      const chunks = chunkText(textContent, 1000);
      let insertedIds = [];

      for (const chunk of chunks) {
        let embeddingStr = null;
        if (settings.api_key) {
          try {
            const vector = await aiService.embedText(settings.provider, settings.api_key, chunk);
            embeddingStr = JSON.stringify(vector);
          } catch (e) {
            console.error("Embedding generation failed for chunk", e.message);
          }
        }

        await new Promise((resolve, reject) => {
          const sql = `INSERT INTO ai_knowledge_base (widget_id, type, content, embedding, file_name) VALUES (?, ?, ?, ?, ?)`;
          db.query(sql, [widgetId, type || 'text', chunk, embeddingStr, fileName], (ierr, ires) => {
            if (ierr) return reject(ierr);
            insertedIds.push(ires.insertId);
            resolve();
          });
        });
      }

      res.json({ success: true, message: `Stored ${chunks.length} vector chunks natively.`, ids: insertedIds });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.updateKnowledge = async (req, res) => {
  const { widgetId, id } = req.params;
  const body = req.body || {};
  const { content } = body;

  try {
    const settingsSql = `SELECT provider, api_key FROM widget_ai_settings WHERE widget_id = ?`;
    db.query(settingsSql, [widgetId], async (err, settingsResult) => {
      if (err) return res.status(500).json({ error: err.message });
      const settings = settingsResult[0] || {};

      let embeddingStr = null;
      if (settings.api_key && content) {
        const aiService = require("../services/aiService");
        try {
          const vector = await aiService.embedText(settings.provider, settings.api_key, content);
          embeddingStr = JSON.stringify(vector);
        } catch (e) {
          console.error("Embedding generation failed", e.message);
        }
      }

      const sql = `UPDATE ai_knowledge_base SET content = ?, embedding = ? WHERE id = ? AND widget_id = ?`;
      db.query(sql, [content, embeddingStr, id, widgetId], (uerr) => {
        if (uerr) return res.status(500).json({ error: uerr.message });
        res.json({ success: true, message: "Knowledge embedded and updated natively!" });
      });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
  const { question, context_instruction, response_type, language, tone } = req.body;

  if (!question) return res.status(400).json({ error: "Question parameter missing" });

  const settingsSql = `SELECT * FROM widget_ai_settings WHERE widget_id = ?`;
  db.query(settingsSql, [widgetId], (err, settingsResult) => {
    if (err) return res.status(500).json({ error: err });
    if (!settingsResult.length || !settingsResult[0].api_key) {
      return res.status(400).json({ error: "AI not configured for this widget or missing API key." });
    }

    const settings = settingsResult[0];

    const kbSql = `SELECT content, embedding FROM ai_knowledge_base WHERE widget_id = ? AND status = 'active'`;
    db.query(kbSql, [widgetId], async (kbErr, kbResult) => {
      let kbContext = "";
      const aiService = require("../services/aiService");

      if (!kbErr && kbResult.length) {
        if (settings.api_key) {
          try {
            const vectorMath = require("../utils/vectorMath");
            const qVector = await aiService.embedText(settings.provider, settings.api_key, question);

            const scored = kbResult.map(row => {
              let score = 0;
              if (row.embedding) {
                const rowVector = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
                score = vectorMath.cosineSimilarity(qVector, rowVector);
              }
              return { content: row.content, score };
            });

            scored.sort((a, b) => b.score - a.score);
            // Take top 3 most relevant chunks to drastically reduce tokens
            kbContext = scored.slice(0, 3).map(s => s.content).join("\n\n");
          } catch (e) {
            console.error("Agent RAG Error: ", e.message);
          }
        }
        // Fallback if embeddings fail
        if (!kbContext) {
          kbContext = kbResult.slice(0, 3).map(k => k.content).join("\n\n");
        }
      }

      const messages = [];
      let sysPrompt = "You are an internal AI assistant helping a human agent craft responses. Do not address an external user.";

      if (context_instruction) sysPrompt += `\nSpecial instructions: ${context_instruction}`;

      if (response_type) {
        sysPrompt += `\nResponse Format: The output MUST be strictly formatted as a ${response_type}.`;
        sysPrompt += `\nSTRICT RULE: You are talking to a human agent, not a computer. DO NOT output JSON payloads, API schemas, or markdown code blocks unless explicitly requested. Provide conversational plain-text only.`;
      }
      if (language) sysPrompt += `\nLanguage: The output MUST be strictly written in ${language}.`;

      const finalTone = tone || settings.tone || 'professional';
      sysPrompt += `\nTone: Your response should be strongly written in a ${finalTone} tone.`;

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


// ok and now we move forward to the admin architextrures and the notifications management

// here now we need more advanced routes for the admin and the users like - user will signup through - google oauth as and also - gmail and password and we check the duplicate email also and we generate a unique id which we use as widgetid or else some uniquenies and user will preview his profile and also update profile like mail, password , profile picture and some other fields and along 

// and as per admin admin can see there all users, active users it can update the users active and inactive like they can loggin or not and also view there profiles and other reports we create early and some other things and can delete the user also and view there unqiue id also 

// and now there is a notification section management where the registered user email of the user will receive the emails and whatsapp also so i create a payload which user will save the notification setting and there post and get apis and update and along multiple forwarding mail and much more features and admin can setup the notification setting and whatsapp managements and along the email configuration from the admin side so create that apis also and also a panel notification api also where user will see the notification inside panel as well and mark as read so create these architecutre completely proper

// {
//     "engineConfig": {
//         "smartBatching": true,
//         "batchIntervalSeconds": 30,
//         "quietHours": {
//             "enabled": false,
//             "schedule": "22:00-08:00",
//             "timezone": "UTC"
//         }
//     },
//     "routingMatrix": [
//         {
//             "eventId": 1,
//             "eventKey": "new_inbound_message",
//             "channels": {
//                 "email": true,
//                 "web": true,
//                 "whatsapp": true
//             },
//             "alertTone": "Standard"
//         },
//         {
//             "eventId": 2,
//             "eventKey": "ai_handover_request",
//             "channels": {
//                 "email": true,
//                 "web": true,
//                 "whatsapp": true
//             },
//             "alertTone": "High Alert"
//         },
//         {
//             "eventId": 3,
//             "eventKey": "sla_warning_(breach)",
//             "channels": {
//                 "email": true,
//                 "web": true,
//                 "whatsapp": true
//             },
//             "alertTone": "Urgent"
//         },
//         {
//             "eventId": 4,
//             "eventKey": "new_lead_/_form_submission",
//             "channels": {
//                 "email": true,
//                 "web": false,
//                 "whatsapp": true
//             },
//             "alertTone": "Pop"
//         },
//         {
//             "eventId": 5,
//             "eventKey": "internal_team_@mention",
//             "channels": {
//                 "email": true,
//                 "web": true,
//                 "whatsapp": false
//             },
//             "alertTone": "Chime"
//         },
//         {
//             "eventId": 6,
//             "eventKey": "system_service_alert",
//             "channels": {
//                 "email": true,
//                 "web": true,
//                 "whatsapp": false
//             },
//             "alertTone": "Standard"
//         },
//         {
//             "eventId": 7,
//             "eventKey": "weekly_analytics_digest",
//             "channels": {
//                 "email": true,
//                 "web": false,
//                 "whatsapp": false
//             },
//             "alertTone": "None"
//         }
//     ],
//     "dispatchTargets": {
//         "emails": [
//             "admin@company.com"
//         ],
//         "whatsappNumbers": [
//             "+91 98765 43210"
//         ]
//     }
// }