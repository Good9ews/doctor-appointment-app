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

const seriesIdParamRules = [param("seriesId").isMongoId().withMessage("invalid series id")];

// daysOfWeek uses JS Date.getDay() convention: 0 = Sunday .. 6 = Saturday.
const createRecurringValidationRules = [
  body("doctor").isMongoId().withMessage("doctor must be a valid id"),
  body("startDate")
    .isISO8601()
    .withMessage("startDate must be a valid ISO 8601 date")
    .toDate(),
  body("endDate")
    .isISO8601()
    .withMessage("endDate must be a valid ISO 8601 date")
    .toDate(),
  body("daysOfWeek")
    .isArray({ min: 1, max: 7 })
    .withMessage("daysOfWeek must be a non-empty array of weekday numbers (0 = Sunday .. 6 = Saturday)")
    .custom((days) => {
      if (!days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
        throw new Error("daysOfWeek must only contain integers from 0 (Sunday) to 6 (Saturday)");
      }
      return true;
    }),
  body("startTime")
    .matches(TIME_RE)
    .withMessage("startTime must be in HH:mm format"),
  body("endTime")
    .matches(TIME_RE)
    .withMessage("endTime must be in HH:mm format"),
];

module.exports = {
  doctorIdParamRules,
  availabilityIdParamRules,
  seriesIdParamRules,
  createAvailabilityValidationRules,
  updateAvailabilityValidationRules,
  createRecurringValidationRules,
};
