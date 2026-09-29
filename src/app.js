const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const dotenv = require("dotenv");
const helmet = require("helmet");
const connectDB = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const errorHandler = require("./middleware/errorHandler");

dotenv.config();

const app = express();

app.use(helmet());

// Single reverse-proxy hop (e.g. a PaaS router or one Nginx/load-balancer in front of the
// app). Needed so req.ip reflects the real client, not the proxy -- otherwise every client
// collapses to one rate-limiter key. Adjust if the real deployment has a different hop count.
app.set("trust proxy", 1);

app.use(express.json());

app.use("/api/doctors", doctorRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Doctor Appointment API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/appointments", appointmentRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Not found",
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  const REQUIRED_ENV_VARS = ["MONGODB_URI", "JWT_SECRET"];
  const missingEnvVars = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missingEnvVars.length > 0) {
    console.error(`Missing required environment variable(s): ${missingEnvVars.join(", ")}`);
    process.exit(1);
  }

  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;
