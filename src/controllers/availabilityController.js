const Availability = require("../models/Availability");
const Doctor = require("../models/Doctor");

const getAllAvailability = async (req, res) => {
  try {
    const availability = await Availability.find().sort({
      date: 1,
      startTime: 1,
    });

    return res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    console.error("Failed to fetch availability:", error.message);

    return res.status(500).json({
      success: false,
      message: "Availability database is unavailable right now.",
    });
  }
};

const getAvailabilityByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const doctorExists = await Doctor.findById(doctorId);
    if (!doctorExists) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    const availability = await Availability.find({ doctor: doctorId }).sort({
      date: 1,
      startTime: 1,
    });

    return res.status(200).json({
      success: true,
      count: availability.length,
      data: availability,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const createAvailability = async (req, res) => {
  try {
    const { doctor, date, startTime, endTime } = req.body;

    if (!doctor || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Please provide doctor, date, startTime, and endTime",
      });
    }

    const doctorExists = await Doctor.findById(doctor);
    if (!doctorExists) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    const existingSlot = await Availability.findOne({
      doctor,
      date,
      startTime,
      endTime,
      isBooked: false,
    });

    if (existingSlot) {
      return res.status(409).json({
        success: false,
        message: "This availability slot already exists",
      });
    }

    const availability = await Availability.create({
      doctor,
      date,
      startTime,
      endTime,
      isBooked: false,
    });

    return res.status(201).json({
      success: true,
      message: "Availability created successfully",
      data: availability,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAllAvailability,
  getAvailabilityByDoctor,
  createAvailability,
};
