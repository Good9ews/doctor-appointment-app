const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/database");
const doctorRoutes = require("./routes/doctorRoutes");

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/doctors", doctorRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Doctor Appointment API is running",
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
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

startServer();
