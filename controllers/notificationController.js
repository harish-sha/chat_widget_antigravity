const db = require("../db");

// --- Global Settings Payload API ---
exports.saveSettings = (req, res) => {
  const { widgetId } = req.params;
  const { engineConfig, routingMatrix, dispatchTargets } = req.body;

  const sql = `
    INSERT INTO notification_settings (widget_id, engine_config, routing_matrix, dispatch_targets)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
       engine_config = ?, routing_matrix = ?, dispatch_targets = ?
  `;
  
  // JSON stringification is natively handled by MySQL JSON logic if parsed correctly, 
  // but strictly stringifying it protects Node formatting constraints.
  const ec = JSON.stringify(engineConfig || {});
  const rm = JSON.stringify(routingMatrix || []);
  const dt = JSON.stringify(dispatchTargets || {});

  db.query(sql, [widgetId, ec, rm, dt, ec, rm, dt], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: "Notification Dispatch Matrix saved gracefully" });
  });
};

exports.getSettings = (req, res) => {
  const { widgetId } = req.params;
  db.query(`SELECT engine_config, routing_matrix, dispatch_targets FROM notification_settings WHERE widget_id = ?`, [widgetId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!results.length) return res.json({ settings: null });

    const row = results[0];
    res.json({
       success: true,
       settings: {
          engineConfig: typeof row.engine_config === 'string' ? JSON.parse(row.engine_config) : (row.engine_config || {}),
          routingMatrix: typeof row.routing_matrix === 'string' ? JSON.parse(row.routing_matrix) : (row.routing_matrix || []),
          dispatchTargets: typeof row.dispatch_targets === 'string' ? JSON.parse(row.dispatch_targets) : (row.dispatch_targets || {})
       }
    });
  });
};

// --- In-App Panel Architecture APIs ---
exports.getInAppAlerts = (req, res) => {
  const { widgetId } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  // Let UI fetch unread count instantly
  db.query(`SELECT COUNT(*) as unread FROM in_app_notifications WHERE widget_id = ? AND is_read = FALSE`, [widgetId], (errUnread, resUnread) => {
     const unreadCount = resUnread ? (resUnread[0]?.unread || 0) : 0;

     db.query(`SELECT COUNT(*) as total FROM in_app_notifications WHERE widget_id = ?`, [widgetId], (errCount, resCount) => {
        if (errCount) return res.status(500).json({ error: errCount.message });
        const total = resCount[0].total;

        db.query(`SELECT * FROM in_app_notifications WHERE widget_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`, [widgetId, limit, offset], (errList, resList) => {
           if (errList) return res.status(500).json({ error: errList.message });

           res.json({
              success: true,
              unreadCount,
              total,
              page,
              limit,
              alerts: resList
           });
        });
     });
  });
};

exports.markAlertRead = (req, res) => {
  const { alertId } = req.params;
  db.query(`UPDATE in_app_notifications SET is_read = TRUE WHERE id = ?`, [alertId], (err) => {
     if (err) return res.status(500).json({ error: err.message });
     res.json({ success: true, message: "Alert marked as read." });
  });
};

// Tooling for internal system calls to push physical panel notifications directly
exports.createSystemAlert = (widgetId, title, message, alertTone = "Standard") => {
   return new Promise((resolve, reject) => {
     db.query(`INSERT INTO in_app_notifications (widget_id, title, message, alert_tone) VALUES (?, ?, ?, ?)`, [widgetId, title, message, alertTone], (err) => {
        if (err) reject(err);
        resolve(true);
     });
   });
};
