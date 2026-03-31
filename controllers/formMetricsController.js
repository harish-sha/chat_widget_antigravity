const db = require("../db");

// 1. Dashboard Lead Generation Summary
exports.getMetricsSummary = (req, res) => {
  const { widgetId } = req.params;
  const { fromDate, toDate, formVersion } = req.query;

  let formWhere = `WHERE widget_id = ?`;
  let convWhere = `WHERE widget_id = ?`;  // For relative conversion rate
  const formParams = [widgetId];
  const convParams = [widgetId];

  if (fromDate) {
    formWhere += ` AND created_at >= ?`;
    convWhere += ` AND created_at >= ?`;
    formParams.push(fromDate);
    convParams.push(fromDate);
  }
  if (toDate) {
    formWhere += ` AND created_at <= ?`;
    convWhere += ` AND created_at <= ?`;
    formParams.push(toDate);
    convParams.push(toDate);
  }
  if (formVersion) {
    formWhere += ` AND form_version = ?`;
    formParams.push(formVersion);
  }

  const sqlTotalLeads = `SELECT COUNT(*) as totalLeads FROM form_submissions ${formWhere}`;
  const sqlTotalConvs = `SELECT COUNT(*) as totalConvs FROM conversations ${convWhere}`;
  
  const sqlDevices = `
    SELECT JSON_UNQUOTE(JSON_EXTRACT(meta, '$.device')) as device, COUNT(*) as count 
    FROM form_submissions 
    ${formWhere} 
    GROUP BY JSON_UNQUOTE(JSON_EXTRACT(meta, '$.device'))
  `;

  const sqlChart = `
    SELECT DATE(created_at) as date, COUNT(*) as leadCount
    FROM form_submissions
    ${formWhere}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  db.query(sqlTotalLeads, formParams, (errL, resL) => {
    if (errL) return res.status(500).json({ error: errL.message });
    
    db.query(sqlTotalConvs, convParams, (errC, resC) => {
      if (errC) return res.status(500).json({ error: errC.message });
      
      db.query(sqlDevices, formParams, (errD, resD) => {
        if (errD) return res.status(500).json({ error: errD.message });
        
        db.query(sqlChart, formParams, (errChart, resChart) => {
           if (errChart) return res.status(500).json({ error: errChart.message });

           const totalLeads = Number(resL[0]?.totalLeads) || 0;
           const totalConvs = Number(resC[0]?.totalConvs) || 0;
           const conversionRate = totalConvs > 0 ? ((totalLeads / totalConvs) * 100).toFixed(2) : '0.00';

           const deviceBreakdown = { mobile: 0, desktop: 0, tablet: 0, unknown: 0 };
           resD.forEach(row => {
               const dev = row.device ? row.device.toLowerCase() : 'unknown';
               if (deviceBreakdown[dev] !== undefined) {
                   deviceBreakdown[dev] += Number(row.count);
               } else {
                   deviceBreakdown.unknown += Number(row.count);
               }
           });

           res.json({
             success: true,
             summary: {
               totalLeadsCaptured: totalLeads,
               totalWidgetConversations: totalConvs,
               conversionRatePercentage: conversionRate
             },
             deviceBreakdown,
             chartData: resChart.map(row => ({
               date: row.date,
               leads: Number(row.leadCount)
             }))
           });
        });
      });
    });
  });
};

// 2. Granular Data Grid for Actual Leads / CRM
exports.getMetricsLogs = (req, res) => {
  const { widgetId } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const { device, formVersion, fromDate, toDate, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

  let whereClause = `WHERE widget_id = ?`;
  const params = [widgetId];

  if (device) {
    whereClause += ` AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.device')) = ?`;
    params.push(device);
  }
  if (formVersion) {
    whereClause += ` AND form_version = ?`;
    params.push(formVersion);
  }
  if (fromDate) {
    whereClause += ` AND created_at >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    whereClause += ` AND created_at <= ?`;
    params.push(toDate);
  }

  const allowedSorts = ['created_at', 'form_version'];
  const safeSortBy = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const countSql = `SELECT COUNT(*) AS total FROM form_submissions ${whereClause}`;

  db.query(countSql, params, (err, countResult) => {
    if (err) return res.status(500).json({ error: err.message });
    const total = countResult[0].total;

    // Pull core submission detail array
    const sql = `
      SELECT id, form_version, answers, session_id, conversation_id, meta, created_at
      FROM form_submissions
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `;

    db.query(sql, [...params, limit, offset], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const parsedLogs = results.map(r => {
        let extractedDevice = "unknown";
        try {
           const parsedMeta = typeof r.meta === 'string' ? JSON.parse(r.meta) : (r.meta || {});
           extractedDevice = parsedMeta.device || "unknown";
        } catch(e) {}

        let parsedAnswers = r.answers;
        if (typeof r.answers === 'string') {
           try { parsedAnswers = JSON.parse(r.answers); } catch(e) {}
        }

        return {
           id: r.id,
           form_version: r.form_version,
           session_id: r.session_id,
           conversation_id: r.conversation_id,
           created_at: r.created_at,
           device: extractedDevice,
           answers: parsedAnswers
        };
      });

      res.json({
        page,
        limit,
        count: parsedLogs.length,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
        logs: parsedLogs
      });
    });
  });
};

// 3. Platform Admin Form Aggregation
exports.getAdminReports = (req, res) => {
  const { fromDate, toDate } = req.query;

  let sysWhere = `WHERE 1=1`;
  const params = [];

  if (fromDate) {
    sysWhere += ` AND created_at >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    sysWhere += ` AND created_at <= ?`;
    params.push(toDate);
  }

  // Global Time Series Lead Capture Graph
  const sqlChart = `
    SELECT DATE(created_at) as date, COUNT(*) as leadCount
    FROM form_submissions
    ${sysWhere}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  // System Device Analytics
  const sqlDevices = `
    SELECT JSON_UNQUOTE(JSON_EXTRACT(meta, '$.device')) as device, COUNT(*) as count 
    FROM form_submissions 
    ${sysWhere} 
    GROUP BY JSON_UNQUOTE(JSON_EXTRACT(meta, '$.device'))
  `;

  // Master Widget Grid (tenant ranking by Form Submissions)
  const sqlWidgets = `
    SELECT 
      widget_id,
      COUNT(*) as total_leads,
      MAX(created_at) as most_recent_lead
    FROM form_submissions
    ${sysWhere}
    GROUP BY widget_id
    ORDER BY total_leads DESC
  `;

  db.query(sqlChart, params, (errChart, resChart) => {
    if (errChart) return res.status(500).json({ error: errChart.message });

    db.query(sqlDevices, params, (errProv, resDevices) => {
      if (errProv) return res.status(500).json({ error: errProv.message });

      db.query(sqlWidgets, params, (errWidget, resWidgets) => {
        if (errWidget) return res.status(500).json({ error: errWidget.message });

        let totalPlatformLeads = 0;
        resWidgets.forEach(w => { totalPlatformLeads += Number(w.total_leads); });

        // Normalize JSON Devices
        const globalDeviceBreakdown = { mobile: 0, desktop: 0, tablet: 0, unknown: 0 };
        resDevices.forEach(row => {
            const dev = row.device ? row.device.toLowerCase() : 'unknown';
            if (globalDeviceBreakdown[dev] !== undefined) {
                globalDeviceBreakdown[dev] += Number(row.count);
            } else {
                globalDeviceBreakdown.unknown += Number(row.count);
            }
        });

        res.json({
          success: true,
          globalOverview: {
            system_total_leads: totalPlatformLeads
          },
          globalDeviceBreakdown,
          globalChartData: resChart.map(c => ({
             date: c.date,
             leads: Number(c.leadCount)
          })),
          widgetBreakdown: resWidgets.map(w => ({
              widget_id: w.widget_id,
              total_leads_captured: Number(w.total_leads),
              last_lead_at: w.most_recent_lead
          }))
        });
      });
    });
  });
};
