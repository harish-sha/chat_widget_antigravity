const express = require("express");
const router = express.Router();
const conversationController = require("../controllers/conversationController");

router.post("/create", conversationController.createConversation);
router.post("/resolve", conversationController.resolveConversation);
router.get("/:widgetId", conversationController.getConversations);

module.exports = router;
