const express = require("express");
const rateLimit = require("express-rate-limit");
const { register, login, me } = require("../controllers/authController");
const { registerValidationRules, loginValidationRules } = require("../services/validation/authValidation");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  // Only failed attempts count. Without this, a legitimate user who logs in successfully
  // more than 10 times in the window locks themselves (and anyone sharing their IP/proxy)
  // out for the rest of it.
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts, please try again later",
  },
});

const registerRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many registration attempts, please try again later",
  },
});

router.post("/register", registerRateLimiter, registerValidationRules, register);
router.post("/login", loginRateLimiter, loginValidationRules, login);
router.get("/me", authenticate, me);

module.exports = router;
