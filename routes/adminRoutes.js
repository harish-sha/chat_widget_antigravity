const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
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

module.exports = router;
