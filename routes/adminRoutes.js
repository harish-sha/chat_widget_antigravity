const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const subAdminController = require("../controllers/subscriptionAdminController");
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");

// All admin routes must be validated by the dual auth wall
router.use(authMiddleware);
router.use(adminMiddleware);

router.get("/users", adminController.getAllUsers);
router.put("/users/:id/status", adminController.toggleUserStatus);
router.delete("/users/:id", adminController.deleteUser);

// Multi-Channel Service Providers Setup 
router.post("/channels/providers", adminController.addProvider);
router.get("/channels/providers", adminController.getProviders);
router.put("/channels/providers/:id/default", adminController.setDefaultProvider);
router.post("/channels/test-email", adminController.testSmtpConnection);

// Structural SaaS Financial Config Arrays
router.post("/billing/plans", subAdminController.createPlan);
router.get("/billing/plans", subAdminController.getAllPlans);
router.get("/billing/subscriptions", subAdminController.getGlobalSubscriptions);

module.exports = router;
