const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { book, listMine, getOne, updateStatus, cancel } = require("../controllers/appointmentController");
const {
  bookAppointmentValidationRules,
  appointmentIdValidationRules,
  updateStatusValidationRules,
  listAppointmentsValidationRules,
} = require("../services/validation/appointmentValidation");

const router = express.Router();

router.use(authenticate);

router.post("/", requireRole("patient"), bookAppointmentValidationRules, book);
router.get("/", listAppointmentsValidationRules, listMine);
router.get("/:id", appointmentIdValidationRules, getOne);
router.patch("/:id/status", updateStatusValidationRules, updateStatus);
router.delete("/:id", appointmentIdValidationRules, cancel);

module.exports = router;
