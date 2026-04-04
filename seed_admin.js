const db = require("./db");
const bcrypt = require("bcrypt");

const runSeed = async () => {
    try {
        console.log("Compiling Node Database Environment...");

        // 1. Establish Channel Provider Matrix
        const sqlProviders = `
            CREATE TABLE IF NOT EXISTS global_service_providers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                channel ENUM('email', 'whatsapp', 'sms') NOT NULL,
                provider_name VARCHAR(100) NOT NULL,
                config JSON,
                is_default BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        await new Promise((resolve, reject) => {
           db.query(sqlProviders, (err) => {
               if (err) return reject(err);
               resolve();
           });
        });
        console.log("[OK] Multi-Channel Global Providers Schema verified!");

        // 2. Inject Super Admin
        const adminEmail = "admin@chatwidget.com";
        const adminPass = "AdminPass123!";
        const wId = "SYSTEM_ADMIN_ROOT";
        
        const hash = await bcrypt.hash(adminPass, 10);

        // Natively Upsert to prevent crashes if already ran
        const sqlAdmin = `
            INSERT INTO users (name, email, password_hash, role, widget_id, is_active) 
            VALUES ('Platform Root Admin', ?, ?, 'admin', ?, 1)
            ON DUPLICATE KEY UPDATE password_hash = ?, is_active = 1, role = 'admin'
        `;

        await new Promise((resolve, reject) => {
           db.query(sqlAdmin, [adminEmail, hash, wId, hash], (err) => {
               if (err) return reject(err);
               resolve();
           });
        });
        console.log(`[SUCCESS] God-Mode Root Admin secured!\nEmail: ${adminEmail}\nPassword: ${adminPass}`);
        
        process.exit(0);
    } catch (e) {
        console.error("FATAL SEED ERROR:", e);
        process.exit(1);
    }
};

runSeed();
