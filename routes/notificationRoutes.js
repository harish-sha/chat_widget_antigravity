const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { authMiddleware } = require("../middleware/authMiddleware");

// All notification modifications are secured behind JWT Validation
router.use(authMiddleware);

// Core Configuration Engine
router.post("/settings/:widgetId", notificationController.saveSettings);
router.get("/settings/:widgetId", notificationController.getSettings);

// User Interface Alert Feeds
router.get("/inbox/:widgetId", notificationController.getInAppAlerts);
router.put("/inbox/:alertId/read", notificationController.markAlertRead);

module.exports = router;
