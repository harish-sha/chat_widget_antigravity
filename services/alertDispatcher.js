const db = require("../db");
const emailService = require("./emailService");
const notificationController = require("../controllers/notificationController");

/**
 * Natively intercepts active backend triggers, queries the user's specific JSON configuration,
 * and routes the alert through the appropriate native Custom SMTP or Web channel.
 */
exports.fire = (widgetId, eventKey, payloadData = {}) => {
  if (!widgetId || !eventKey) return;

  db.query(`SELECT routing_matrix, dispatch_targets FROM notification_settings WHERE widget_id = ?`, [widgetId], (err, results) => {
    if (err || results.length === 0) return; // Silent catch, no settings found

    try {
      const row = results[0];
      const routingMatrix = typeof row.routing_matrix === 'string' ? JSON.parse(row.routing_matrix) : (row.routing_matrix || []);
      const dispatchTargets = typeof row.dispatch_targets === 'string' ? JSON.parse(row.dispatch_targets) : (row.dispatch_targets || {});

      // Find the specific trigger in the Admin's configured Matrix
      const config = routingMatrix.find(r => r.eventKey === eventKey);

      // If the Admin deleted this event rule, skip it silently
      if (!config || !config.channels) return;

      const titleMap = {
        "new_inbound_message": "New User Message",
        "ai_handover_request": "System/AI Handover Request",
        "new_lead_/_form_submission": "New Lead Generated!"
      };
      const title = titleMap[eventKey] || "System Alert";
      const messageBody = JSON.stringify(payloadData);

      // 1. In-App Web Routing
      if (config.channels.web === true) {
        notificationController.createSystemAlert(widgetId, title, `Data payload: ${messageBody}`, config.alertTone || 'Standard')
          .catch(e => console.error("Web Panel Alert generation failed", e));
      }

      // 2. Custom SMTP Email Routing
      if (config.channels.email === true && dispatchTargets.emails && dispatchTargets.emails.length > 0) {
        const htmlFormat = `
            <div style="font-family: sans-serif; padding: 20px;">
               <h2 style="color: #2e6c80;">${title}</h2>
               <p>A new system trigger strictly matched your Notification Matrix (<strong>${eventKey}</strong>).</p>
               <br/>
               <pre style="background: #f4f4f4; padding: 15px; border-radius: 5px;">${JSON.stringify(payloadData, null, 2)}</pre>
               <br/>
               <p><small>Delivered natively from your SaaS Backend infrastructure.</small></p>
            </div>
         `;

        // Iterate and fire physical custom SMTP dispatches
        dispatchTargets.emails.forEach(targetEmail => {
          emailService.sendSystemEmail(targetEmail, `[SaaS Alert] ${title}`, htmlFormat)
            .catch(e => console.error(`Email Dispatch Router dropped for ${targetEmail}:`, e.message));
        });
      }

      // 3. The Enterprise DSA Routing Algorithm
      if (eventKey === 'ai_handover_request' && payloadData.conversationId) {
          const cid = payloadData.conversationId;
          
          // Least-Occupied Shift Routing:
          // Retrieves all active agents precisely matching the tenant's widget who are actively clocked into their shift,
          // Counts their active chat assignments, and rigorously sorts by whoever is least overwhelmed.
          const routerSql = `
             SELECT a.id, COUNT(c.id) as active_chats 
             FROM human_agents a
             LEFT JOIN conversations c ON c.assigned_agent_id = a.id AND c.status = 'open'
             WHERE a.widget_id = ? 
               AND a.status = 'active'
               AND CURRENT_TIME() BETWEEN a.shift_start_time AND a.shift_end_time
             GROUP BY a.id
             ORDER BY active_chats ASC
             LIMIT 1
          `;

          db.query(routerSql, [widgetId], (err, agentRes) => {
              if (!err && agentRes && agentRes.length > 0) {
                 const bestAgent = agentRes[0].id;
                 db.query(`UPDATE conversations SET assigned_agent_id = ? WHERE id = ?`, [bestAgent, cid]);
                 const systemChat = `INSERT INTO messages (conversation_id, sender, message, message_type) VALUES (?, 'system', 'An agent has been dynamically assigned to your chat and will respond shortly.', 'system')`;
                 db.query(systemChat, [cid]);
              } else {
                 // Fallback block if zero workers are alive (2AM test, etc.)
                 const systemChat = `INSERT INTO messages (conversation_id, sender, message, message_type) VALUES (?, 'system', 'Our team is currently offline or entirely at capacity. Please leave your email in the chat and we will physically contact you during business hours.', 'system')`;
                 db.query(systemChat, [cid]);
              }
          });
      }

    } catch (e) {
      console.error("Alert Dispatcher Engine crashed routing event:", e.message);
    }
  });
};
