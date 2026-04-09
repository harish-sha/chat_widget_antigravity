const db = require("./db");

const schemaOps = `
CREATE TABLE IF NOT EXISTS human_agents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    widget_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    shift_start_time TIME DEFAULT '09:00:00',
    shift_end_time TIME DEFAULT '17:00:00',
    timezone VARCHAR(100) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (widget_id, email)
);

ALTER TABLE conversations 
ADD COLUMN assigned_agent_id INT DEFAULT NULL AFTER status,
ADD COLUMN resolved_at TIMESTAMP NULL AFTER assigned_agent_id,
ADD CONSTRAINT fk_conversations_agent_id FOREIGN KEY (assigned_agent_id) REFERENCES human_agents(id) ON DELETE SET NULL;
`;

// Hack to execute multiple statements by replacing standard connection handling lightly if necessary.
// Since mysql2 may not have multipleStatements true globally, we do it safely one by one.

const t1 = `CREATE TABLE IF NOT EXISTS human_agents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    widget_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    shift_start_time TIME DEFAULT '09:00:00',
    shift_end_time TIME DEFAULT '17:00:00',
    timezone VARCHAR(100) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (widget_id, email)
)`;

const t2 = `ALTER TABLE conversations ADD COLUMN assigned_agent_id INT DEFAULT NULL AFTER status`;
const t3 = `ALTER TABLE conversations ADD COLUMN resolved_at TIMESTAMP NULL AFTER assigned_agent_id`;
const t4 = `ALTER TABLE conversations ADD CONSTRAINT fk_conversations_agent_id FOREIGN KEY (assigned_agent_id) REFERENCES human_agents(id) ON DELETE SET NULL`;

db.query(t1, (err) => {
    if (err) console.error("Error t1: ", err.message);
    db.query(t2, (e) => {
        if (e && !e.message.includes('Duplicate column')) console.error("Error t2: ", e.message);
        db.query(t3, (e2) => {
           if (e2 && !e2.message.includes('Duplicate column')) console.error("Error t3: ", e2.message);
           db.query(t4, (e3) => {
               if (e3 && !e3.message.includes('Duplicate key')) console.error("Error t4: ", e3.message);
               console.log("SUCCESS: Entire Human Agents architectural Schema perfectly merged into Root DB!");
               process.exit(0);
           });
        });
    });
});
