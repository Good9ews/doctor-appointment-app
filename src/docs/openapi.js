const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Doctor Appointment API",
      version: "1.0.0",
      description:
        "Patients book appointments with doctors. Reads (doctor directory, availability slots) are public; writes require a Bearer JWT and are scoped to the caller's own records.",
    },
    servers: [
      {
        url: "https://doctex-backend.onrender.com",
description: "Production",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "JWT from POST /api/auth/register or POST /api/auth/login",
        },
      },
    },
    security: [],
  },

  apis: [
    path.join(__dirname, "components.js"),
    path.join(__dirname, "../routes/authRoutes.js"),
    path.join(__dirname, "../routes/doctorRoutes.js"),
    path.join(__dirname, "../routes/availabilityRoutes.js"),
    path.join(__dirname, "../routes/appointmentRoutes.js"),
  ],
};

const openApiSpec = swaggerJsdoc(options);

module.exports = { openApiSpec };