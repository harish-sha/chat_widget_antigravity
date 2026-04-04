const db = require("../db");

exports.handleUpload = (req, res) => {
   if (!req.file) return res.status(400).json({ error: "No physical file buffer received." });

   // The system intelligently routes the uploader's Identity.
   // If uploaded from the Admin dashboard, `req.user` exists. If uploaded from the customer chat widget, it checks `req.body.widgetId`!
   const widgetId = (req.user && req.user.widgetId) ? req.user.widgetId : (req.body.widgetId || null);
   const uploaderId = (req.user && req.user.id) ? req.user.id : null;

   // Dynamically determine exact URL endpoint based on native express host headers
   const hostUrl = req.protocol + '://' + req.get('host');
   const publicFileUrl = `${hostUrl}/uploads/${req.file.filename}`;

   const sql = `
       INSERT INTO uploaded_media (widget_id, uploader_id, file_name, original_name, mime_type, file_size, url)
       VALUES (?, ?, ?, ?, ?, ?, ?)
   `;
   
   db.query(sql, [widgetId, uploaderId, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, publicFileUrl], (err, insertResult) => {
      if (err) return res.status(500).json({ error: "File saved internally but database mapping crashed: " + err.message });
      
      res.json({
         success: true,
         message: "Media securely hosted in SaaS Environment",
         mediaId: insertResult.insertId,
         url: publicFileUrl,
         originalName: req.file.originalname,
         mimeType: req.file.mimetype
      });
   });
};
