const express = require("express");
const {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} = require("../controllers/doctorController");
const { authenticate, authorizeRole } = require("../middleware/auth");
const {
  authorizeDoctorOwner,
  authorizeDoctorSelf,
} = require("../middleware/doctorAuthorization");
const {
  validateCreateDoctor,
  validateDoctorId,
  validateUpdateDoctor,
} = require("../services/validation/doctorValidation");

const router = express.Router();

// Reads stay public -- the doctor directory must be browsable for booking.
router.get("/", getAllDoctors);
router.get("/:id", ...validateDoctorId, getDoctorById);
router.post(
  "/",
  authenticate,
  authorizeRole("doctor"),
  ...validateCreateDoctor,
  authorizeDoctorSelf,
  createDoctor,
);
router.put(
  "/:id",
  authenticate,
  authorizeRole("doctor"),
  ...validateDoctorId,
  ...validateUpdateDoctor,
  authorizeDoctorOwner,
  updateDoctor,
);
router.delete(
  "/:id",
  authenticate,
  authorizeRole("doctor"),
  ...validateDoctorId,
  authorizeDoctorOwner,
  deleteDoctor,
);

module.exports = router;

/**
 * @swagger
 * tags:
 *   - name: Doctors
 *     description: Doctor directory (public reads, self-service writes)
 *
 * /api/doctors:
 *   get:
 *     tags: [Doctors]
 *     summary: List and search doctor profiles
 *     parameters:
 *       - in: query
 *         name: specialization
 *         schema:
 *           type: string
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Matches name, specialization, and location
 *     responses:
 *       200:
 *         description: Matching profiles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Doctor'
 *   post:
 *     tags: [Doctors]
 *     summary: Create your doctor profile
 *     description: Callers can only create a profile linked to their own account.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user, name, specialization, email, phone, location]
 *             properties:
 *               user:
 *                 type: string
 *                 description: Your own user id
 *               name:
 *                 type: string
 *                 example: Greg House
 *               specialization:
 *                 type: string
 *                 example: Diagnostics
 *               email:
 *                 type: string
 *                 example: house@example.com
 *               phone:
 *                 type: string
 *                 example: +15551234567
 *               location:
 *                 type: string
 *                 example: Princeton
 *               bio:
 *                 type: string
 *     responses:
 *       201:
 *         description: Profile created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Doctor'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not a doctor account, or profile for another user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Profile already exists for this user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /api/doctors/{id}:
 *   get:
 *     tags: [Doctors]
 *     summary: Get one doctor profile
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Doctor'
 *       400:
 *         description: Malformed id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Doctor not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     tags: [Doctors]
 *     summary: Update your doctor profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               specialization:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               location:
 *                 type: string
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Doctor'
 *       400:
 *         description: Invalid input or malformed id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Another user's profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Doctor not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     tags: [Doctors]
 *     summary: Delete your doctor profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile deleted
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
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Another user's profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Doctor not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
