const nodemailer = require("nodemailer");
const db = require("../db");

/**
 * Dynamically fetches the Custom SMTP settings from the Admin Database Matrix
 * and initiates a physical Email dispatch exactly from the Admin's own Server!
 */
exports.sendSystemEmail = async (toEmail, subject, htmlContent) => {
  return new Promise((resolve, reject) => {
    // Locate the explicit Default Custom SMTP that the Admin uploaded
    db.query(`SELECT config FROM global_service_providers WHERE channel = 'email' AND is_default = TRUE`, (err, results) => {
      if (err) return reject(new Error("Database error while fetching Custom SMTP configuration."));
      if (!results || results.length === 0) return reject(new Error("No Active Custom SMTP Email Configuration found in Platform Admin settings."));

      let smtpConfig = {};
      try {
        smtpConfig = typeof results[0].config === 'string' ? JSON.parse(results[0].config) : results[0].config;
      } catch (e) {
        return reject(new Error("Corrupted Custom SMTP Configuration inside Database."));
      }

      // Safeguard against missing vital SMTP credentials
      if (!smtpConfig.host || !smtpConfig.auth?.user || !smtpConfig.auth?.pass) {
         return reject(new Error("Custom SMTP Configuration is missing vital Host or Password credentials."));
      }

      // Compiles the Native SMTP Transport dynamically!
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port || 465,
        secure: smtpConfig.secure !== undefined ? smtpConfig.secure : true, // True for 465, false for other ports
        auth: {
          user: smtpConfig.auth.user,
          pass: smtpConfig.auth.pass,
        },
      });

      const mailOptions = {
        from: smtpConfig.fromEmail || smtpConfig.auth.user, // The Admin's registered sender
        to: toEmail,
        subject: subject,
        html: htmlContent,
      };

      // Blast the physical email!
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
           console.error("Custom SMTP Send Failure:", error.message);
           return reject(error);
        }
        resolve(info);
      });
    });
  });
};
