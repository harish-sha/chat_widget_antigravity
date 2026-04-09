const express = require("express");
const router = express.Router();
const agentController = require("../controllers/agentController");
const { authMiddleware } = require("../middleware/authMiddleware");

// All these routes strictly require the SaaS Tenant (Admin) JWT Token!
router.use(authMiddleware);

// Agent Team Management
router.post("/", agentController.createAgent);
router.get("/", agentController.getAgents);
router.put("/:agentId", agentController.updateAgent);
router.delete("/:agentId", agentController.deleteAgent);

// Agent Analytics Platform
router.get("/reports/metrics", agentController.getAgentReport);

module.exports = router;
