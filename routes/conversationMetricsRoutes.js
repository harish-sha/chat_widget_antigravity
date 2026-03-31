const express = require("express");
const router = express.Router();
const metricsCtrl = require("../controllers/conversationMetricsController");

router.get("/summary/:widgetId", metricsCtrl.getMetricsSummary);
router.get("/logs/:widgetId", metricsCtrl.getMetricsLogs);
router.get("/admin/reports", metricsCtrl.getAdminReports);

module.exports = router;
