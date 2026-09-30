const { validationResult } = require("express-validator");
const Availability = require("../models/Availability");
const Doctor = require("../models/Doctor");

const AVAILABILITY_DB_UNAVAILABLE = "Availability database is unavailable right now.";

const validationErrorResponse = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
    return true;
  }
  return false;
};

const timeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const dayBounds = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const overlapsWindow = (startTime, endTime, slot) =>
  timeToMinutes(startTime) < timeToMinutes(slot.endTime) &&
  timeToMinutes(slot.startTime) < timeToMinutes(endTime);

const findOverlappingSlot = (doctorId, date, startTime, endTime, excludeId = null) =>
  Availability.find({
    doctor: doctorId,
    date: { $gte: dayBounds(date).start, $lte: dayBounds(date).end },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).then((slots) => slots.find((slot) => overlapsWindow(startTime, endTime, slot)));

// Slots are doctor self-service: the slot's doctor profile must belong to the
// caller. Returns the slot, or sends the 404/403 response and returns null.
const findOwnedSlot = async (req, res) => {
  const slot = await Availability.findById(req.params.id);
  if (!slot) {
    res.status(404).json({
      success: false,
      message: "Availability slot not found",
    });
    return null;
  }

  const doctorProfile = await Doctor.findById(slot.doctor);
  if (!doctorProfile || doctorProfile.user.toString() !== req.user._id.toString()) {
    res.status(403).json({
      success: false,
      message: "Not authorized to manage availability for this doctor",
    });
    return null;
  }

  return slot;
};

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
      message: AVAILABILITY_DB_UNAVAILABLE,
    });
  }
};

const getAvailabilityByDoctor = async (req, res) => {
  if (validationErrorResponse(req, res)) {
    return undefined;
  }

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
      message: AVAILABILITY_DB_UNAVAILABLE,
    });
  }
};

const createAvailability = async (req, res) => {
  if (validationErrorResponse(req, res)) {
    return undefined;
  }

  try {
    const { doctor, date, startTime, endTime } = req.body;

    if (!doctor || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Please provide doctor, date, startTime, and endTime",
      });
    }

    const doctorProfile = await Doctor.findById(doctor);
    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // Doctors manage only their own slots -- there is no admin role, so
    // creating availability for another doctor's profile is forbidden.
    if (doctorProfile.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to manage availability for this doctor",
      });
    }

    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
    }

    const { start: dayStart } = dayBounds(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dayStart < today) {
      return res.status(400).json({
        success: false,
        message: "Cannot create availability in the past",
      });
    }

    const clash = await findOverlappingSlot(doctor, date, startTime, endTime);

    if (clash) {
      return res.status(409).json({
        success: false,
        message: "This slot overlaps an existing availability slot",
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
      message: AVAILABILITY_DB_UNAVAILABLE,
    });
  }
};

const updateAvailability = async (req, res) => {
  if (validationErrorResponse(req, res)) {
    return undefined;
  }

  try {
    const slot = await findOwnedSlot(req, res);
    if (!slot) {
      return undefined;
    }

    // A booked slot's time is committed to a patient appointment -- it can
    // only change via cancel/rebook, never by editing the slot underneath it.
    if (slot.isBooked) {
      return res.status(409).json({
        success: false,
        message: "Cannot modify a booked slot",
      });
    }

    // The owning doctor is the ownership anchor and is immutable.
    const date = req.body.date !== undefined ? req.body.date : slot.date;
    const startTime = req.body.startTime !== undefined ? req.body.startTime : slot.startTime;
    const endTime = req.body.endTime !== undefined ? req.body.endTime : slot.endTime;

    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
    }

    const { start: dayStart } = dayBounds(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dayStart < today) {
      return res.status(400).json({
        success: false,
        message: "Cannot create availability in the past",
      });
    }

    const clash = await findOverlappingSlot(slot.doctor, date, startTime, endTime, slot._id);
    if (clash) {
      return res.status(409).json({
        success: false,
        message: "This slot overlaps an existing availability slot",
      });
    }

    slot.date = date;
    slot.startTime = startTime;
    slot.endTime = endTime;
    await slot.save();

    return res.status(200).json({
      success: true,
      message: "Availability updated successfully",
      data: slot,
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
      message: AVAILABILITY_DB_UNAVAILABLE,
    });
  }
};

const deleteAvailability = async (req, res) => {
  if (validationErrorResponse(req, res)) {
    return undefined;
  }

  try {
    const slot = await findOwnedSlot(req, res);
    if (!slot) {
      return undefined;
    }

    // Deleting a booked slot would orphan the appointment made against it --
    // cancel the appointment first, which frees the slot.
    if (slot.isBooked) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a booked slot",
      });
    }

    await slot.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Availability deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: AVAILABILITY_DB_UNAVAILABLE,
    });
  }
};

module.exports = {
  getAllAvailability,
  getAvailabilityByDoctor,
  createAvailability,
  updateAvailability,
  deleteAvailability,
};
