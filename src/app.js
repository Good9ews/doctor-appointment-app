const express = require("express");
const helmet = require("helmet");
const authRoutes = require("./routes/authRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(helmet());

// Single reverse-proxy hop (e.g. a PaaS router or one Nginx/load-balancer in front of the
// app). Needed so req.ip reflects the real client, not the proxy -- otherwise every client
// collapses to one rate-limiter key. Adjust if the real deployment has a different hop count.
app.set("trust proxy", 1);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Doctor Appointment API is running",
  });
});

app.use("/api/auth", authRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Not found",
  });
});

app.use(errorHandler);

module.exports = app;
