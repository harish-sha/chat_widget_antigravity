const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");

router.get("/settings/:widgetId", aiController.getSettings);
router.post("/settings/:widgetId", aiController.updateSettings);

router.get("/knowledge/:widgetId", aiController.getKnowledge);
router.post("/knowledge/:widgetId", aiController.addKnowledge);
router.delete("/knowledge/:id", aiController.deleteKnowledge);

router.post("/assist/:widgetId", aiController.agentAssist);

module.exports = router;
