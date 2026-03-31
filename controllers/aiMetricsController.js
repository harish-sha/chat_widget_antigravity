const db = require("../db");

// 1. Widget Dashboard Summary & Chart Arrays
exports.getMetricsSummary = (req, res) => {
  const { widgetId } = req.params;
  const { fromDate, toDate, model } = req.query;

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
  if (model) {
    whereClause += ` AND model = ?`;
    params.push(model);
  }

  const sqlTotals = `
    SELECT 
      COUNT(*) as totalRequests,
      SUM(total_tokens) as totalTokensUsed,
      AVG(latency_ms) as averageLatency,
      SUM(CASE WHEN is_fallback = TRUE THEN 1 ELSE 0 END) as fallbackCount
    FROM ai_metrics_log
    ${whereClause}
  `;

  // Dynamically group by Day for charts
  const sqlChart = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as requests,
      SUM(total_tokens) as tokens,
      AVG(latency_ms) as avgLatency
    FROM ai_metrics_log
    ${whereClause}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  db.query(sqlTotals, params, (err, resultsTotals) => {
    if (err) return res.status(500).json({ error: err.message });

    db.query(sqlChart, params, (err, resultsChart) => {
      if (err) return res.status(500).json({ error: err.message });

      const data = resultsTotals[0] || {};
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
        },
        chartData: resultsChart.map(row => ({
          date: row.date,
          requests: Number(row.requests),
          tokens: Number(row.tokens) || 0,
          avgLatency: Math.round(Number(row.avgLatency) || 0)
        }))
      });
    });
  });
};

// 2. Widget Log List & Grid
exports.getMetricsLogs = (req, res) => {
  const { widgetId } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const { provider, model, hasError, fromDate, toDate, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

  let whereClause = `WHERE widget_id = ?`;
  const params = [widgetId];

  if (provider) {
    whereClause += ` AND provider = ?`;
    params.push(provider);
  }
  if (model) {
    whereClause += ` AND model LIKE ?`;
    params.push(`%${model}%`);
  }
  if (hasError === "1" || hasError === "true") {
    whereClause += ` AND is_fallback = TRUE`;
  }
  if (hasError === "0" || hasError === "false") {
    whereClause += ` AND is_fallback = FALSE`;
  }
  if (fromDate) {
    whereClause += ` AND created_at >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    whereClause += ` AND created_at <= ?`;
    params.push(toDate);
  }

  // Prevent SQL injection on sorting
  const allowedSorts = ['created_at', 'latency_ms', 'total_tokens', 'is_fallback', 'prompt_tokens'];
  const safeSortBy = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const countSql = `SELECT COUNT(*) AS total FROM ai_metrics_log ${whereClause}`;

  db.query(countSql, params, (err, countResult) => {
    if (err) return res.status(500).json({ error: err.message });

    const total = countResult[0].total;
    const sql = `
      SELECT * FROM ai_metrics_log 
      ${whereClause} 
      ORDER BY ${safeSortBy} ${safeSortOrder} 
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

// 3. Global Admin Multi-Dimensional Reports
exports.getAdminReports = (req, res) => {
  const { fromDate, toDate } = req.query;

  let whereClause = `WHERE 1=1`;
  const params = [];

  if (fromDate) {
    whereClause += ` AND created_at >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    whereClause += ` AND created_at <= ?`;
    params.push(toDate);
  }

  // Breakdown by specific Widget
  const sqlWidgets = `
    SELECT 
      widget_id,
      COUNT(*) as total_requests,
      SUM(total_tokens) as total_tokens_billed,
      SUM(prompt_tokens) as total_prompt_tokens,
      SUM(completion_tokens) as total_completion_tokens,
      AVG(latency_ms) as avg_latency_ms,
      SUM(CASE WHEN is_fallback = TRUE THEN 1 ELSE 0 END) as total_errors
    FROM ai_metrics_log
    ${whereClause}
    GROUP BY widget_id
    ORDER BY total_tokens_billed DESC
  `;

  // Global Time Series Chart
  const sqlChart = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as requests,
      SUM(total_tokens) as tokens,
      AVG(latency_ms) as avgLatency
    FROM ai_metrics_log
    ${whereClause}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  // Provider Split
  const sqlProviders = `
    SELECT 
      provider,
      COUNT(*) as requests,
      SUM(total_tokens) as tokens
    FROM ai_metrics_log
    ${whereClause}
    GROUP BY provider
  `;

  db.query(sqlWidgets, params, (errWidget, resWidgets) => {
    if (errWidget) return res.status(500).json({ error: errWidget.message });

    db.query(sqlChart, params, (errChart, resChart) => {
      if (errChart) return res.status(500).json({ error: errChart.message });

      db.query(sqlProviders, params, (errProv, resProv) => {
        if (errProv) return res.status(500).json({ error: errProv.message });

        const globalStats = resWidgets.reduce((acc, row) => {
          acc.system_requests += Number(row.total_requests);
          acc.system_tokens += Number(row.total_tokens_billed);
          return acc;
        }, { system_requests: 0, system_tokens: 0 });

        res.json({
          success: true,
          globalOverview: globalStats,
          providerFilters: resProv.map(p => ({
            provider: p.provider,
            requests: Number(p.requests),
            tokens: Number(p.tokens)
          })),
          globalChartData: resChart.map(c => ({
            date: c.date,
            requests: Number(c.requests),
            tokens: Number(c.tokens),
            avgLatency: Math.round(Number(c.avgLatency) || 0)
          })),
          widgetBreakdown: resWidgets
        });
      });
    });
  });
};
