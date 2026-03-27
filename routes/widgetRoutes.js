const express = require("express");
const router = express.Router();
const widgetController = require("../controllers/widgetController");

router.post("/save", widgetController.saveWidget);
router.get("/config/:widgetId", widgetController.getWidgetConfig);

module.exports = router;
