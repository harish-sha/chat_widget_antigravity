const db = require("../db");

exports.getMetricsSummary = (req, res) => {
  const { widgetId } = req.params;
  const { fromDate, toDate } = req.query;

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

  const sql = `
    SELECT 
      COUNT(*) as totalRequests,
      SUM(total_tokens) as totalTokensUsed,
      AVG(latency_ms) as averageLatency,
      SUM(CASE WHEN is_fallback = TRUE THEN 1 ELSE 0 END) as fallbackCount
    FROM ai_metrics_log
    ${whereClause}
  `;

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const data = results[0];
    const total = Number(data.totalRequests) || 0;
    const fallback = Number(data.fallbackCount) || 0;
    const fallbackRate = total > 0 ? ((fallback / total) * 100).toFixed(2) : '0.00';

    res.json({
      success: true,
      summary: {
        totalRequests: total,
        totalTokensUsed: Number(data.totalTokensUsed) || 0,
        averageLatency: Number(data.averageLatency) ? Math.round(data.averageLatency) : 0,
        fallbackCount: fallback,
        fallbackRatePercentage: fallbackRate
      }
    });
  });
};

exports.getMetricsLogs = (req, res) => {
  const { widgetId } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const { provider, hasError, fromDate, toDate } = req.query;

  let whereClause = `WHERE widget_id = ?`;
  const params = [widgetId];

  if (provider) {
    whereClause += ` AND provider = ?`;
    params.push(provider);
  }
  if (hasError === "1" || hasError === "true") {
    whereClause += ` AND is_fallback = TRUE`;
  }
  if (fromDate) {
    whereClause += ` AND created_at >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    whereClause += ` AND created_at <= ?`;
    params.push(toDate);
  }

  const countSql = `SELECT COUNT(*) AS total FROM ai_metrics_log ${whereClause}`;

  db.query(countSql, params, (err, countResult) => {
    if (err) return res.status(500).json({ error: err.message });

    const total = countResult[0].total;
    const sql = `
      SELECT * FROM ai_metrics_log 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;

    db.query(sql, [...params, limit, offset], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        page,
        limit,
        count: results.length,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
        logs: results
      });
    });
  });
};

exports.getAdminReports = (req, res) => {
  const sql = `
    SELECT 
      widget_id,
      COUNT(*) as total_requests,
      SUM(total_tokens) as total_tokens_billed,
      SUM(prompt_tokens) as total_prompt_tokens,
      SUM(completion_tokens) as total_completion_tokens,
      AVG(latency_ms) as avg_latency_ms,
      SUM(CASE WHEN is_fallback = TRUE THEN 1 ELSE 0 END) as total_errors
    FROM ai_metrics_log
    GROUP BY widget_id
    ORDER BY total_tokens_billed DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const globalStats = results.reduce((acc, row) => {
       acc.system_requests += Number(row.total_requests);
       acc.system_tokens += Number(row.total_tokens_billed);
       return acc;
    }, { system_requests: 0, system_tokens: 0 });

    res.json({
      success: true,
      globalOverview: globalStats,
      widgetBreakdown: results
    });
  });
};
