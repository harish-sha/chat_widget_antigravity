const express = require("express");
const router = express.Router();
const formMetricsCtrl = require("../controllers/formMetricsController");

router.get("/summary/:widgetId", formMetricsCtrl.getMetricsSummary);
router.get("/logs/:widgetId", formMetricsCtrl.getMetricsLogs);
router.get("/admin/reports", formMetricsCtrl.getAdminReports);

module.exports = router;
