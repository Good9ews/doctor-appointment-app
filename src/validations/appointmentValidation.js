const { body, param, query, validationResult } = require("express-validator");

const bookAppointmentValidation = [
  body("doctorId")
    .notEmpty()
    .withMessage("Doctor ID is required")
    .isMongoId()
    .withMessage("Invalid doctor ID"),

  body("availabilityId")
    .notEmpty()
    .withMessage("Availability ID is required")
    .isMongoId()
    .withMessage("Invalid availability ID"),

  body("appointmentDate")
    .notEmpty()
    .withMessage("Appointment date is required")
    .isISO8601()
    .withMessage("Invalid date format (use ISO 8601)"),

  body("startTime")
    .notEmpty()
    .withMessage("Start time is required")
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("Start time must be in HH:mm format"),

  body("endTime")
    .notEmpty()
    .withMessage("End time is required")
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("End time must be in HH:mm format"),
];

const updateStatusValidation = [
  param("id").isMongoId().withMessage("Invalid appointment ID"),
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["pending", "confirmed", "cancelled", "completed"])
    .withMessage("Invalid status"),
];

const getAppointmentsValidation = [
  query("status")
    .optional()
    .isIn(["pending", "confirmed", "cancelled", "completed"])
    .withMessage("Invalid status filter"),
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

module.exports = {
  bookAppointmentValidation,
  updateStatusValidation,
  getAppointmentsValidation,
  validate,
};
