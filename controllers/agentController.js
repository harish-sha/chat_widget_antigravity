const db = require("../db");
const bcrypt = require("bcrypt");

exports.createAgent = (req, res) => {
    const widgetId = req.user.widgetId;
    const { name, email, password, shiftStartTime, shiftEndTime, timezone } = req.body;

    if (!name || !email || !password) return res.status(400).json({ error: "Name, email, and password strictly required to spawn an agent." });

    // Enforce Constraints
    db.query('SELECT COUNT(id) AS agent_cnt FROM human_agents WHERE widget_id = ?', [widgetId], (err, cntRes) => {
        if (err) return res.status(500).json({ error: err.message });
        const currentCount = cntRes[0].agent_cnt;

        db.query(`SELECT pln.max_agents FROM subscriptions sub LEFT JOIN saas_plans pln ON sub.plan_code = pln.plan_code WHERE sub.widget_id = ? AND sub.status = 'active'`, [widgetId], async (err, planRes) => {
            const maxAgents = (planRes && planRes.length > 0 && planRes[0].max_agents) ? planRes[0].max_agents : 1; // Free tier allows 1 Agent globally

            if (currentCount >= maxAgents) {
                return res.status(400).json({ error: `SaaS Limit Exceeded: Your active plan restricts you to ${maxAgents} human agents maximum. Please aggressively upgrade your subscription to expand your workforce.` });
            }

            try {
                const passHash = await bcrypt.hash(password, 10);
                const start = shiftStartTime || '09:00:00';
                const end = shiftEndTime || '17:00:00';
                const tz = timezone || 'UTC';

                const insertSql = `
                    INSERT INTO human_agents (widget_id, name, email, password_hash, shift_start_time, shift_end_time, timezone)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
                db.query(insertSql, [widgetId, name, email, passHash, start, end, tz], (err2) => {
                    if (err2) {
                        return res.status(400).json({ error: "Failed to allocate Agent. Email might be a duplicate for this specific widget.", details: err2.message });
                    }
                    res.json({ success: true, message: "Human Agent formally initiated into the SaaS Matrix!" });
                });
            } catch (e) {
                res.status(500).json({ error: "Cryptographic failure mapping agent password natively." });
            }
        });
    });
};

exports.getAgents = (req, res) => {
    const widgetId = req.user.widgetId;
    db.query(`SELECT id, name, email, status, shift_start_time, shift_end_time, timezone, created_at FROM human_agents WHERE widget_id = ?`, [widgetId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: results });
    });
};

exports.updateAgent = (req, res) => {
    const widgetId = req.user.widgetId;
    const { agentId } = req.params;
    const { name, status, shiftStartTime, shiftEndTime, timezone } = req.body;

    // Updates name, status and hours dynamically
    const sql = `
       UPDATE human_agents SET 
         name = COALESCE(?, name),
         status = COALESCE(?, status),
         shift_start_time = COALESCE(?, shift_start_time),
         shift_end_time = COALESCE(?, shift_end_time),
         timezone = COALESCE(?, timezone)
       WHERE id = ? AND widget_id = ?
    `;
    db.query(sql, [name, status, shiftStartTime, shiftEndTime, timezone, agentId, widgetId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Agent profile securely overridden." });
    });
};

exports.deleteAgent = (req, res) => {
    const widgetId = req.user.widgetId;
    const { agentId } = req.params;
    // Because of foreign keys (ON DELETE SET NULL), purging them safely removes them without destroying historical chats
    db.query(`DELETE FROM human_agents WHERE id = ? AND widget_id = ?`, [agentId, widgetId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Agent physically stripped from the SaaS array." });
    });
};

// Analytics Data Block
exports.getAgentReport = (req, res) => {
    const widgetId = req.user.widgetId;
    const sql = `
        SELECT 
            ha.id, ha.name, ha.email, ha.status,
            COUNT(DISTINCT c.id) as total_assigned_chats,
            COUNT(DISTINCT m.id) as total_messages_sent,
            AVG(TIMESTAMPDIFF(SECOND, c.created_at, c.resolved_at)) as avg_resolution_time_seconds
        FROM human_agents ha
        LEFT JOIN conversations c ON ha.id = c.assigned_agent_id
        LEFT JOIN messages m ON m.conversation_id = c.id AND m.sender = 'agent'
        WHERE ha.widget_id = ?
        GROUP BY ha.id
    `;
    db.query(sql, [widgetId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: results });
    });
};
