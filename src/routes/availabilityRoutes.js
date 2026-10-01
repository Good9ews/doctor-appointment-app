const express = require("express");
const {
  getAllAvailability,
  createAvailability,
  getAvailabilityByDoctor,
  updateAvailability,
  deleteAvailability,
  createRecurringAvailability,
  deleteSeries,
} = require("../controllers/availabilityController");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const {
  doctorIdParamRules,
  availabilityIdParamRules,
  seriesIdParamRules,
  createAvailabilityValidationRules,
  updateAvailabilityValidationRules,
  createRecurringValidationRules,
} = require("../services/validation/availabilityValidation");

const router = express.Router();

// Reads stay public -- patients need to browse slots to book.
router.get("/", getAllAvailability);
router.get("/doctor/:doctorId", doctorIdParamRules, getAvailabilityByDoctor);
// Writes are doctor self-service: the controller additionally verifies the
// slot's doctor profile belongs to the caller.
router.post("/", authenticate, requireRole("doctor"), createAvailabilityValidationRules, createAvailability);
router.post("/recurring", authenticate, requireRole("doctor"), createRecurringValidationRules, createRecurringAvailability);
router.put("/:id", authenticate, requireRole("doctor"), updateAvailabilityValidationRules, updateAvailability);
router.delete("/series/:seriesId", authenticate, requireRole("doctor"), seriesIdParamRules, deleteSeries);
router.delete("/:id", authenticate, requireRole("doctor"), availabilityIdParamRules, deleteAvailability);

module.exports = router;

/**
 * @swagger
 * tags:
 *   - name: Availability
 *     description: Bookable time slots (public reads, doctor self-service writes)
 *
 * /api/availability:
 *   get:
 *     tags: [Availability]
 *     summary: List all availability slots
 *     responses:
 *       200:
 *         description: All slots
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Availability'
 *   post:
 *     tags: [Availability]
 *     summary: Create a slot for your own doctor profile
 *     description: Times are HH:mm, date is ISO 8601 and never in the past. Same-day overlaps for the same doctor are rejected.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [doctor, date, startTime, endTime]
 *             properties:
 *               doctor:
 *                 type: string
 *                 description: Your own doctor profile id
 *               date:
 *                 type: string
 *                 format: date-time
 *               startTime:
 *                 type: string
 *                 example: 09:00
 *               endTime:
 *                 type: string
 *                 example: 12:00
 *     responses:
 *       201:
 *         description: Slot created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Availability'
 *       400:
 *         description: Invalid input, bad time order, or past date
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
 *         description: Not a doctor account, or slot for another doctor
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
 *       409:
 *         description: Slot overlaps an existing one
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /api/availability/doctor/{doctorId}:
 *   get:
 *     tags: [Availability]
 *     summary: List slots for one doctor
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The doctor's slots
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
 *                     $ref: '#/components/schemas/Availability'
 *       400:
 *         description: Malformed doctor id
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
 *
 * /api/availability/{id}:
 *   put:
 *     tags: [Availability]
 *     summary: Edit your slot's date/times
 *     description: Owning doctor is immutable. Booked slots cannot be edited -- cancel the appointment first.
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
 *               date:
 *                 type: string
 *                 format: date-time
 *               startTime:
 *                 type: string
 *                 example: 09:30
 *               endTime:
 *                 type: string
 *                 example: 10:30
 *     responses:
 *       200:
 *         description: Slot updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Availability'
 *       400:
 *         description: Invalid input, bad time order, or past date
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
 *         description: Another doctor's slot
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Slot not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Overlaps another slot, or slot is booked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     tags: [Availability]
 *     summary: Delete your unbooked slot
 *     description: Booked slots cannot be deleted -- cancel the appointment first.
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
 *         description: Slot deleted
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
 *         description: Another doctor's slot
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Slot not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Slot is booked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /api/availability/recurring:
 *   post:
 *     tags: [Availability]
 *     summary: Generate slots from a weekly pattern
 *     description: Expands into concrete slots (one per matching weekday in range, capped at 92 days). Conflicting dates are skipped and reported, not fatal. daysOfWeek uses 0 = Sunday .. 6 = Saturday.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [doctor, startDate, endDate, daysOfWeek, startTime, endTime]
 *             properties:
 *               doctor:
 *                 type: string
 *                 description: Your own doctor profile id
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               daysOfWeek:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 6
 *                 example: [1, 3, 5]
 *               startTime:
 *                 type: string
 *                 example: 09:00
 *               endTime:
 *                 type: string
 *                 example: 12:00
 *     responses:
 *       201:
 *         description: Series generated
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     seriesId:
 *                       type: string
 *                     created:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Availability'
 *                     skipped:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                           reason:
 *                             type: string
 *       400:
 *         description: Invalid input, bad range, or no matching future dates
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
 *         description: Not a doctor account, or slots for another doctor
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
 *
 * /api/availability/series/{seriesId}:
 *   delete:
 *     tags: [Availability]
 *     summary: Delete a generated series' future unbooked slots
 *     description: Booked slots are kept (cancel the appointment first); past slots stay as history.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: seriesId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Series pruned
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     seriesId:
 *                       type: string
 *                     deleted:
 *                       type: integer
 *                     retainedBooked:
 *                       type: integer
 *       400:
 *         description: Malformed series id
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
 *         description: Another doctor's series
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Series not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
