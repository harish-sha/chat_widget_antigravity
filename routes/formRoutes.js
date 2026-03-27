const express = require("express");
const router = express.Router();
const formController = require("../controllers/formController");

router.post("/submit", formController.submitForm);
router.get("/submissions/:widgetId/:version", formController.getSubmissionsByVersion);
router.get("/submissions/:widgetId", formController.getAllSubmissions);
router.get("/versions/:widgetId", formController.getFormVersions);

module.exports = router;
