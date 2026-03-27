const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");

router.post("/send", messageController.sendMessage);
router.post("/starter", messageController.sendStarterMessage);
router.get("/:conversationId", messageController.getMessages);

module.exports = router;
