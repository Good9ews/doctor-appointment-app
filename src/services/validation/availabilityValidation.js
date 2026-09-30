const { body, param } = require("express-validator");

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const doctorIdParamRules = [param("doctorId").isMongoId().withMessage("invalid doctor id")];

const availabilityIdParamRules = [param("id").isMongoId().withMessage("invalid availability id")];

const createAvailabilityValidationRules = [
  body("doctor").isMongoId().withMessage("doctor must be a valid id"),
  body("date")
    .isISO8601()
    .withMessage("date must be a valid ISO 8601 date")
    .toDate(),
  body("startTime")
    .matches(TIME_RE)
    .withMessage("startTime must be in HH:mm format"),
  body("endTime")
    .matches(TIME_RE)
    .withMessage("endTime must be in HH:mm format"),
];

const updateAvailabilityValidationRules = [
  ...availabilityIdParamRules,
  body("date")
    .optional()
    .isISO8601()
    .withMessage("date must be a valid ISO 8601 date")
    .toDate(),
  body("startTime")
    .optional()
    .matches(TIME_RE)
    .withMessage("startTime must be in HH:mm format"),
  body("endTime")
    .optional()
    .matches(TIME_RE)
    .withMessage("endTime must be in HH:mm format"),
];

module.exports = {
  doctorIdParamRules,
  availabilityIdParamRules,
  createAvailabilityValidationRules,
  updateAvailabilityValidationRules,
};
