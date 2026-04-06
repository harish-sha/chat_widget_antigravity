const express = require("express");
const router = express.Router();
const subController = require("../controllers/subscriptionController");
const { authMiddleware } = require("../middleware/authMiddleware");

// All heavily financial routes are naturally gated behind JWT barriers
router.use(authMiddleware);

// Data UI Pulls
router.get("/plans", subController.getAvailablePlans);
router.get("/my-limits", subController.getMySubscription);

// Financial Dual-Gateway Bridges
router.post("/checkout", subController.createCheckout);
router.post("/portal", subController.createPortal); // Stripe natively
router.post("/verify", subController.createVerify); // Developer test bypass
router.post("/cancel", subController.createCancel); // Universal termination

module.exports = router;
