const db = require("../db");

// 1. Dashboard Conversation Summary & Chronological Chart
exports.getMetricsSummary = (req, res) => {
  const { widgetId } = req.params;
  const { fromDate, toDate } = req.query;

  let convWhere = `WHERE widget_id = ?`;
  let msgWhere = `WHERE conversation_id IN (SELECT id FROM conversations WHERE widget_id = ?)`;
  const params = [widgetId];
  let msgParams = [widgetId]; // message subquery requires identical bounds

  if (fromDate) {
    convWhere += ` AND created_at >= ?`;
    msgWhere += ` AND created_at >= ?`;
    params.push(fromDate);
    msgParams.push(fromDate);
  }
  if (toDate) {
    convWhere += ` AND created_at <= ?`;
    msgWhere += ` AND created_at <= ?`;
    params.push(toDate);
    msgParams.push(toDate);
  }

  const sqlConvTotals = `
    SELECT 
      COUNT(*) as totalConversations,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as openCount,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolvedCount,
      SUM(CASE WHEN bot_active = TRUE THEN 1 ELSE 0 END) as activelyHandledByBot
    FROM conversations
    ${convWhere}
  `;

  const sqlMsgSplit = `
    SELECT sender, COUNT(*) as count 
    FROM messages 
    ${msgWhere} 
    GROUP BY sender
  `;

  const sqlChart = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as conversationCount
    FROM conversations
    ${convWhere}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  db.query(sqlConvTotals, params, (errConv, resConv) => {
    if (errConv) return res.status(500).json({ error: errConv.message });
    
    db.query(sqlMsgSplit, msgParams, (errMsg, resMsg) => {
      if (errMsg) return res.status(500).json({ error: errMsg.message });
      
      db.query(sqlChart, params, (errChart, resChart) => {
        if (errChart) return res.status(500).json({ error: errChart.message });

        const convData = resConv[0] || {};
        
        // Transform Array of senders into an isolated hashmap for the dashboard pie charts
        const messageBreakdown = { user: 0, bot: 0, agent: 0, system: 0 };
        let totalMessages = 0;
        resMsg.forEach(row => {
          messageBreakdown[row.sender] = Number(row.count);
          totalMessages += Number(row.count);
        });

        const totalConversations = Number(convData.totalConversations) || 0;
        const resolved = Number(convData.resolvedCount) || 0;
        const completionRate = totalConversations > 0 ? ((resolved / totalConversations) * 100).toFixed(2) : '0.00';

        res.json({
          success: true,
          summary: {
            totalConversations,
            openCount: Number(convData.openCount) || 0,
            resolvedCount: resolved,
            completionRatePercentage: completionRate,
            activeBotConversations: Number(convData.activelyHandledByBot) || 0,
            totalMessages
          },
          messageBreakdown,
          chartData: resChart.map(row => ({
            date: row.date,
            conversations: Number(row.conversationCount)
          }))
        });
      });
    });
  });
};

// 2. Paginated Log Explorer & Grid Details
exports.getMetricsLogs = (req, res) => {
  const { widgetId } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const { status, fromDate, toDate, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

  let whereClause = `WHERE widget_id = ?`;
  const params = [widgetId];

  if (status) {
    whereClause += ` AND status = ?`;
    params.push(status);
  }
  if (fromDate) {
    whereClause += ` AND created_at >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    whereClause += ` AND created_at <= ?`;
    params.push(toDate);
  }

  const allowedSorts = ['created_at', 'status', 'bot_active'];
  const safeSortBy = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const countSql = `SELECT COUNT(*) AS total FROM conversations ${whereClause}`;

  db.query(countSql, params, (err, countResult) => {
    if (err) return res.status(500).json({ error: err.message });
    const total = countResult[0].total;

    // Pull detailed table joining counts
    const sql = `
      SELECT 
        c.id, c.session_id, c.status, c.bot_active, c.resolved_by, c.resolve_note, c.created_at,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender = 'user') as user_messages,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender = 'bot') as bot_messages,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender = 'agent') as agent_messages
      FROM conversations c
      ${whereClause} 
      ORDER BY c.${safeSortBy} ${safeSortOrder} 
      LIMIT ? OFFSET ?
    `;

    db.query(sql, [...params, limit, offset], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const enrichedLogs = results.map(r => {
        const userMsg = Number(r.user_messages) || 0;
        const botMsg = Number(r.bot_messages) || 0;
        const agMsg = Number(r.agent_messages) || 0;
        
        return {
           ...r,
           user_messages: userMsg,
           bot_messages: botMsg,
           agent_messages: agMsg,
           total_messages: userMsg + botMsg + agMsg,
           // Mathematical Deflection Assessment (0 human agent touches == Bot Deflection)
           was_deflected: (r.status === 'resolved' && agMsg === 0) ? true : false
        };
      });

      res.json({
        page,
        limit,
        count: enrichedLogs.length,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
        logs: enrichedLogs
      });
    });
  });
};

// 3. Global Master Overviews for Admin SaaS Platform
exports.getAdminReports = (req, res) => {
  const { fromDate, toDate } = req.query;

  let convWhere = `WHERE 1=1`;
  let msgWhere = `WHERE 1=1`;
  const params = [];

  if (fromDate) {
    convWhere += ` AND created_at >= ?`;
    msgWhere += ` AND created_at >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    convWhere += ` AND created_at <= ?`;
    msgWhere += ` AND created_at <= ?`;
    params.push(toDate);
  }

  // Master Widget Grid Split
  const sqlWidgets = `
    SELECT 
      widget_id,
      COUNT(*) as total_conversations,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as total_open,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as total_resolved
    FROM conversations
    ${convWhere}
    GROUP BY widget_id
    ORDER BY total_conversations DESC
  `;

  // System Time Series Graph
  const sqlChart = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as conversationCount
    FROM conversations
    ${convWhere}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  // Global Multi-tenant Message Volume
  const sqlMsgProviders = `
    SELECT sender, COUNT(*) as count 
    FROM messages 
    ${msgWhere} 
    GROUP BY sender
  `;

  db.query(sqlWidgets, params, (errWidget, resWidgets) => {
    if (errWidget) return res.status(500).json({ error: errWidget.message });
    
    db.query(sqlChart, params, (errChart, resChart) => {
      if (errChart) return res.status(500).json({ error: errChart.message });

      db.query(sqlMsgProviders, params, (errProv, resProv) => {
        if (errProv) return res.status(500).json({ error: errProv.message });
        
        let sysConvTotal = 0;
        let sysOpen = 0;
        let sysResolved = 0;

        resWidgets.forEach(row => {
           sysConvTotal += Number(row.total_conversations);
           sysOpen += Number(row.total_open);
           sysResolved += Number(row.total_resolved);
        });

        // Global Deflection Estimation
        const globalBreakdown = { user: 0, bot: 0, agent: 0, system: 0 };
        resProv.forEach(row => {
          globalBreakdown[row.sender] = Number(row.count);
        });

        res.json({
          success: true,
          globalOverview: {
            system_conversations: sysConvTotal,
            system_open: sysOpen,
            system_resolved: sysResolved,
            system_total_messages: globalBreakdown.user + globalBreakdown.bot + globalBreakdown.agent
          },
          globalMessageBreakdown: globalBreakdown,
          globalChartData: resChart.map(c => ({
             date: c.date,
             conversations: Number(c.conversationCount)
          })),
          widgetBreakdown: resWidgets.map(w => ({
              widget_id: w.widget_id,
              total_conversations: Number(w.total_conversations),
              total_open: Number(w.total_open),
              total_resolved: Number(w.total_resolved)
          }))
        });
      });
    });
  });
};
