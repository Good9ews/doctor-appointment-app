const { body, param, query } = require("express-validator");

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const bookAppointmentValidationRules = [
  body("doctorId").isMongoId().withMessage("doctorId must be a valid id"),
  body("availabilityId").isMongoId().withMessage("availabilityId must be a valid id"),
  body("appointmentDate")
    .isISO8601()
    .withMessage("appointmentDate must be a valid ISO 8601 date")
    .toDate(),
  body("startTime")
    .matches(TIME_RE)
    .withMessage("startTime must be in HH:mm format"),
  body("endTime")
    .matches(TIME_RE)
    .withMessage("endTime must be in HH:mm format"),
];

const appointmentIdValidationRules = [
  param("id").isMongoId().withMessage("invalid appointment id"),
];

const updateStatusValidationRules = [
  ...appointmentIdValidationRules,
  body("status")
    .isIn(["pending", "confirmed", "cancelled", "completed"])
    .withMessage("status must be one of pending, confirmed, cancelled, completed"),
];

const listAppointmentsValidationRules = [
  query("status")
    .optional()
    .isIn(["pending", "confirmed", "cancelled", "completed"])
    .withMessage("status must be one of pending, confirmed, cancelled, completed"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be an integer between 1 and 100")
    .toInt(),
];

module.exports = {
  bookAppointmentValidationRules,
  appointmentIdValidationRules,
  updateStatusValidationRules,
  listAppointmentsValidationRules,
};
