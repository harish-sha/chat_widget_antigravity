const db = require("../db");

exports.saveWidget = (req, res) => {
  const { widgetId, config } = req.body;
  const sql = `
 INSERT INTO widgets (widget_id, config)
 VALUES (?, ?)
 ON DUPLICATE KEY UPDATE config = ?
 `;
  const jsonConfig = JSON.stringify(config);

  db.query(sql, [widgetId, jsonConfig, jsonConfig], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    const version = config?.surveyForm?.formVersion;
    if (version) {
      const versionSql = `
        INSERT IGNORE INTO form_versions (widget_id, form_version)
        VALUES (?, ?)
      `;
      db.query(versionSql, [widgetId, version]);
    }
    res.json({ success: true, message: "Widget saved" });
  });
};

exports.getWidgetConfig = (req, res) => {
  const widgetId = req.params.widgetId;
  const sql = `SELECT config FROM widgets WHERE widget_id = ?`;
  db.query(sql, [widgetId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.length === 0) return res.json({ config: null });
    const config = result[0].config;
    res.json({ config });
  });
};
