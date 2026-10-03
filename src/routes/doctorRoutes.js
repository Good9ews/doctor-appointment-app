const express = require("express");

const {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} = require("../controllers/doctorController");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const {
  createDoctorValidationRules,
  doctorIdValidationRules,
  updateDoctorValidationRules,
} = require("../services/validation/doctorValidation");

const router = express.Router();

// Reads stay public -- the doctor directory must be browsable for booking.
router.get("/", getAllDoctors);
router.get(
  "/:id",
  doctorIdValidationRules,
  getDoctorById
);

// Writes are doctor self-service.
// The authenticated user's ID is used by the controller to link the profile
// to the currently signed-in doctor.
router.post(
  "/",
  authenticate,
  requireRole("doctor"),
  createDoctorValidationRules,
  createDoctor
);

router.put(
  "/:id",
  authenticate,
  requireRole("doctor"),
  updateDoctorValidationRules,
  updateDoctor
);

router.delete(
  "/:id",
  authenticate,
  requireRole("doctor"),
  doctorIdValidationRules,
  deleteDoctor
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
 *
 *   post:
 *     tags: [Doctors]
 *     summary: Create your doctor profile
 *     description: The authenticated doctor's account is automatically linked to the profile.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - specialization
 *               - email
 *               - phone
 *               - location
 *             properties:
 *               name:
 *                 type: string
 *                 example: Gabriel Adam
 *               specialization:
 *                 type: string
 *                 example: Dermatology
 *               email:
 *                 type: string
 *                 example: gabriel@doctex.com
 *               phone:
 *                 type: string
 *                 example: 08012345678
 *               location:
 *                 type: string
 *                 example: Lagos
 *               bio:
 *                 type: string
 *                 example: Dermatologist available for appointments.
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
 *                 message:
 *                   type: string
 *                   example: Doctor profile created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Doctor'
 *
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       403:
 *         description: User is not a doctor account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
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
 *
 *       400:
 *         description: Malformed id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: Doctor not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
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
 *                 message:
 *                   type: string
 *                   example: Doctor profile updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Doctor'
 *
 *       400:
 *         description: Invalid input or malformed id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       403:
 *         description: Another user's profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: Doctor not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
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
 *                   example: Doctor profile deleted successfully
 *
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       403:
 *         description: Another user's profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: Doctor not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */