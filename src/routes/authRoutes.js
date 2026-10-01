const express = require("express");
const rateLimit = require("express-rate-limit");
const { register, login, me, logout } = require("../controllers/authController");
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
router.post("/logout", authenticate, logout);

module.exports = router;

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Registration, login, and token management
 *
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Patient
 *               email:
 *                 type: string
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 72
 *               role:
 *                 type: string
 *                 enum: [patient, doctor]
 *     responses:
 *       201:
 *         description: Account created; returns a Bearer JWT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     description: Rate-limited to 10 failed attempts per 15 minutes per IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged in; returns a Bearer JWT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Return the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Missing, invalid, or revoked token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the token used to call this endpoint
 *     description: The token stops working immediately. Other sessions for the same user are unaffected.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logged out
 *       401:
 *         description: Missing, invalid, or revoked token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
