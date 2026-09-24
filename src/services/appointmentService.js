const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Availability = require("../models/Availability");
const Doctor = require("../models/Doctor");
const User = require("../models/User");

/**
 * Helper: Convert "HH:mm" to minutes since midnight
 */
const timeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Check if two time ranges overlap
 */
const timesOverlap = (start1, end1, start2, end2) => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
};

/**
 * Book an appointment
 */
const bookAppointment = async (patientId, data) => {
  const { doctorId, availabilityId, appointmentDate, startTime, endTime } = data;

  // 1. Validate patient exists and is a patient
  const patient = await User.findById(patientId);
  if (!patient || patient.role !== "patient") {
    throw { status: 403, message: "Only patients can book appointments" };
  }

  // 2. Validate doctor exists
  const doctor = await Doctor.findById(doctorId).populate("user");
  if (!doctor) {
    throw { status: 404, message: "Doctor not found" };
  }

  // 3. Validate availability belongs to this doctor
  const availability = await Availability.findById(availabilityId);
  if (!availability) {
    throw { status: 404, message: "Availability slot not found" };
  }

  if (availability.doctor.toString() !== doctorId) {
    throw { status: 400, message: "Availability does not belong to this doctor" };
  }

  // 4. Basic time validation
  if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
    throw { status: 400, message: "End time must be after start time" };
  }

  // Optional: Check that requested time falls within the availability window
  if (
    timeToMinutes(startTime) < timeToMinutes(availability.startTime) ||
    timeToMinutes(endTime) > timeToMinutes(availability.endTime)
  ) {
    throw {
      status: 400,
      message: "Requested time is outside the doctor's availability window",
    };
  }

  // 5. Check for conflicting appointments (same doctor + overlapping time on same date)
  const appointmentDateStart = new Date(appointmentDate);
  appointmentDateStart.setHours(0, 0, 0, 0);
  const appointmentDateEnd = new Date(appointmentDate);
  appointmentDateEnd.setHours(23, 59, 59, 999);

  const existingAppointments = await Appointment.find({
    doctor: doctorId,
    appointmentDate: {
      $gte: appointmentDateStart,
      $lte: appointmentDateEnd,
    },
    status: { $in: ["pending", "confirmed"] }, // only active ones
  });

  const hasConflict = existingAppointments.some((appt) =>
    timesOverlap(startTime, endTime, appt.startTime, appt.endTime)
  );

  if (hasConflict) {
    throw {
      status: 409,
      message: "This time slot is already booked. Please choose another time.",
    };
  }

  // 6. Optional: Prevent patient from double-booking themselves at same time
  const patientConflict = await Appointment.findOne({
    patient: patientId,
    appointmentDate: {
      $gte: appointmentDateStart,
      $lte: appointmentDateEnd,
    },
    status: { $in: ["pending", "confirmed"] },
    $expr: {
      // Simple overlap check can also be done in JS if preferred
    },
  });

  // You can add similar overlap logic for patient if needed

  // 7. Create the appointment
  const appointment = await Appointment.create({
    patient: patientId,
    doctor: doctorId,
    availability: availabilityId,
    appointmentDate,
    startTime,
    endTime,
    status: "pending",
  });

  // Optional: Mark availability as booked / reduce remaining slots
  // await Availability.findByIdAndUpdate(availabilityId, { isBooked: true });

  // Populate for response
  await appointment.populate([
    { path: "patient", select: "name email phone" },
    { path: "doctor", populate: { path: "user", select: "name email" } },
    { path: "availability" },
  ]);

  return appointment;
};

/**
 * Get appointments for the logged-in user (patient or doctor)
 */
const getMyAppointments = async (userId, role, filters = {}) => {
  const { status, page = 1, limit = 10 } = filters;
  const skip = (page - 1) * limit;

  let query = {};

  if (role === "patient") {
    query.patient = userId;
  } else if (role === "doctor") {
    // Find the Doctor document linked to this user
    const doctor = await Doctor.findOne({ user: userId });
    if (!doctor) {
      throw { status: 404, message: "Doctor profile not found" };
    }
    query.doctor = doctor._id;
  } else {
    // Admin can see all – or restrict as needed
  }

  if (status) {
    query.status = status;
  }

  const [appointments, total] = await Promise.all([
    Appointment.find(query)
      .populate("patient", "name email phone")
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" },
      })
      .populate("availability")
      .sort({ appointmentDate: 1, startTime: 1 })
      .skip(skip)
      .limit(limit),
    Appointment.countDocuments(query),
  ]);

  return {
    appointments,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get single appointment (with ownership check)
 */
const getAppointmentById = async (appointmentId, userId, role) => {
  const appointment = await Appointment.findById(appointmentId)
    .populate("patient", "name email phone")
    .populate({
      path: "doctor",
      populate: { path: "user", select: "name email" },
    })
    .populate("availability");

  if (!appointment) {
    throw { status: 404, message: "Appointment not found" };
  }

  // Ownership check
  if (role === "patient" && appointment.patient._id.toString() !== userId) {
    throw { status: 403, message: "Not authorized to view this appointment" };
  }

  if (role === "doctor") {
    const doctor = await Doctor.findOne({ user: userId });
    if (!doctor || appointment.doctor._id.toString() !== doctor._id.toString()) {
      throw { status: 403, message: "Not authorized to view this appointment" };
    }
  }

  return appointment;
};

/**
 * Update appointment status (confirm / cancel / complete)
 */
const updateAppointmentStatus = async (appointmentId, newStatus, userId, role) => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw { status: 404, message: "Appointment not found" };
  }

  // Authorization rules
  if (role === "patient") {
    // Patients can only cancel their own pending/confirmed appointments
    if (appointment.patient.toString() !== userId) {
      throw { status: 403, message: "Not authorized" };
    }
    if (newStatus !== "cancelled") {
      throw { status: 403, message: "Patients can only cancel appointments" };
    }
    if (!["pending", "confirmed"].includes(appointment.status)) {
      throw { status: 400, message: "Cannot cancel this appointment" };
    }
  } else if (role === "doctor") {
    const doctor = await Doctor.findOne({ user: userId });
    if (!doctor || appointment.doctor.toString() !== doctor._id.toString()) {
      throw { status: 403, message: "Not authorized" };
    }
    // Doctors can confirm, cancel, or mark completed
  } else {
    // Admin can do anything
  }

  // Business rules
  if (appointment.status === "completed" || appointment.status === "cancelled") {
    throw { status: 400, message: `Cannot change status of a ${appointment.status} appointment` };
  }

  appointment.status = newStatus;
  await appointment.save();

  await appointment.populate([
    { path: "patient", select: "name email phone" },
    { path: "doctor", populate: { path: "user", select: "name email" } },
  ]);

  return appointment;
};

/**
 * Cancel appointment (convenience wrapper)
 */
const cancelAppointment = async (appointmentId, userId, role) => {
  return updateAppointmentStatus(appointmentId, "cancelled", userId, role);
};

module.exports = {
  bookAppointment,
  getMyAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  cancelAppointment,
};
