const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");

router.get("/settings/:widgetId", aiController.getSettings);
router.put("/admin/settings/:widgetId", aiController.updateAdminSettings);
router.put("/agent/settings/:widgetId", aiController.updateAgentSettings);

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.get("/knowledge/:widgetId", aiController.getKnowledge);
router.post("/knowledge/:widgetId", upload.single("file"), aiController.addKnowledge);
router.put("/knowledge/:widgetId/:id", upload.single("file"), aiController.updateKnowledge);
router.delete("/knowledge/:id", aiController.deleteKnowledge);

router.post("/assist/:widgetId", aiController.agentAssist);

module.exports = router;
