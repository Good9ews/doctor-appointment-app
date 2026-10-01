const { body, param, validationResult } = require("express-validator");

const returnValidationError = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }
  return next();
};

const validateDoctorId = [
  param("id").isMongoId().withMessage("Invalid doctor ID"),
  returnValidationError,
];

const validateCreateDoctor = [
  body("user").isMongoId().withMessage("A valid user ID is required"),
  body("name").isString().trim().notEmpty().withMessage("Name is required"),
  body("specialization")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Specialization is required"),
  body("email").isEmail().withMessage("A valid email address is required"),
  body("phone").isString().trim().notEmpty().withMessage("Phone is required"),
  body("location")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Location is required"),
  body("bio").optional().isString().withMessage("Bio must be a string"),
  returnValidationError,
];

const validateUpdateDoctor = [
  body().custom((_, { req }) => {
    const allowedFields = [
      "name",
      "specialization",
      "email",
      "phone",
      "location",
      "bio",
    ];
    const fields = Object.keys(req.body || {});
    if (
      !fields.length ||
      fields.some((field) => !allowedFields.includes(field))
    ) {
      throw new Error("Provide valid doctor fields to update");
    }
    return true;
  }),
  body("name")
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Name must be a non-empty string"),
  body("specialization")
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Specialization must be a non-empty string"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("A valid email address is required"),
  body("phone")
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Phone must be a non-empty string"),
  body("location")
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Location must be a non-empty string"),
  body("bio").optional().isString().withMessage("Bio must be a string"),
  returnValidationError,
];

module.exports = {
  validateDoctorId,
  validateCreateDoctor,
  validateUpdateDoctor,
};
