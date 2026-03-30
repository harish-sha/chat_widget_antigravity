const express = require("express");
const router = express.Router();
const aiMetricsController = require("../controllers/aiMetricsController");

router.get("/summary/:widgetId", aiMetricsController.getMetricsSummary);
router.get("/logs/:widgetId", aiMetricsController.getMetricsLogs);
router.get("/admin/reports", aiMetricsController.getAdminReports);

module.exports = router;
