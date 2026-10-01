const Appointment = require("../models/Appointment");
const Availability = require("../models/Availability");
const Doctor = require("../models/Doctor");
const User = require("../models/User");

// Service errors are plain { status, message } objects -- the controller maps
// status onto the HTTP response. Anything else escaping a service function is a
// genuine 500 (database down, driver error) and must never leak its text.

const timeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const timesOverlap = (start1, end1, start2, end2) =>
  timeToMinutes(start1) < timeToMinutes(end2) &&
  timeToMinutes(start2) < timeToMinutes(end1);

const dayBounds = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const ACTIVE_STATUSES = ["pending", "confirmed"];

// Valid forward transitions. Terminal states (cancelled, completed) never appear
// as keys, so any change out of them is rejected.
const ALLOWED_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
};

const PATIENT_FIELDS = "name email role";
const DOCTOR_POPULATE = { path: "doctor", populate: { path: "user", select: "name email" } };

const populateAppointment = (query) =>
  query
    .populate("patient", PATIENT_FIELDS)
    .populate(DOCTOR_POPULATE)
    .populate("availability");

const findDoctorProfile = async (userId) => Doctor.findOne({ user: userId });

const bookAppointment = async (patientId, data) => {
  const { doctorId, availabilityId, appointmentDate, startTime, endTime } = data;

  const patient = await User.findById(patientId);
  if (!patient || patient.role !== "patient") {
    throw { status: 403, message: "Only patients can book appointments" };
  }

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    throw { status: 404, message: "Doctor not found" };
  }

  const availability = await Availability.findById(availabilityId);
  if (!availability) {
    throw { status: 404, message: "Availability slot not found" };
  }

  if (availability.doctor.toString() !== doctorId) {
    throw { status: 400, message: "Availability does not belong to this doctor" };
  }

  if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
    throw { status: 400, message: "End time must be after start time" };
  }

  if (
    timeToMinutes(startTime) < timeToMinutes(availability.startTime) ||
    timeToMinutes(endTime) > timeToMinutes(availability.endTime)
  ) {
    throw { status: 400, message: "Requested time is outside the doctor's availability window" };
  }

  const { start: dayStart, end: dayEnd } = dayBounds(appointmentDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dayStart < today) {
    throw { status: 400, message: "Cannot book an appointment in the past" };
  }

  const dateFilter = {
    appointmentDate: { $gte: dayStart, $lte: dayEnd },
    status: { $in: ACTIVE_STATUSES },
  };

  const [doctorAppointments, patientAppointments] = await Promise.all([
    Appointment.find({ ...dateFilter, doctor: doctorId }),
    Appointment.find({ ...dateFilter, patient: patientId }),
  ]);

  const doctorBusy = doctorAppointments.some((a) =>
    timesOverlap(startTime, endTime, a.startTime, a.endTime),
  );

  if (doctorBusy) {
    throw { status: 409, message: "This time slot is already booked. Please choose another time." };
  }

  const patientBusy = patientAppointments.some((a) =>
    timesOverlap(startTime, endTime, a.startTime, a.endTime),
  );

  if (patientBusy) {
    throw { status: 409, message: "You already have an appointment at this time" };
  }

  // Claim the slot atomically: the isBooked:false filter means exactly one
  // concurrent request can win. A check-then-set here would let two requests
  // both pass the check and double-book the slot.
  const claimed = await Availability.findOneAndUpdate(
    { _id: availabilityId, isBooked: false },
    { $set: { isBooked: true } },
    { returnDocument: "after" },
  );

  if (!claimed) {
    throw { status: 409, message: "This availability slot was just booked. Please choose another time." };
  }

  let appointment;
  try {
    appointment = await Appointment.create({
      patient: patientId,
      doctor: doctorId,
      availability: availabilityId,
      appointmentDate,
      startTime,
      endTime,
      status: "pending",
    });
  } catch (error) {
    // Give the slot back so a failed booking never strands it as booked.
    await Availability.findByIdAndUpdate(availabilityId, { $set: { isBooked: false } });
    throw error;
  }

  return populateAppointment(Appointment.findById(appointment._id));
};

const getMyAppointments = async (userId, role, filters = {}) => {
  const { status, page = 1, limit = 10 } = filters;
  const skip = (page - 1) * limit;

  const query = {};
  if (role === "patient") {
    query.patient = userId;
  } else if (role === "doctor") {
    const doctor = await findDoctorProfile(userId);
    if (!doctor) {
      throw { status: 404, message: "Doctor profile not found" };
    }
    query.doctor = doctor._id;
  }

  if (status) {
    query.status = status;
  }

  const [appointments, total] = await Promise.all([
    populateAppointment(
      Appointment.find(query).sort({ appointmentDate: 1, startTime: 1 }).skip(skip).limit(limit),
    ),
    Appointment.countDocuments(query),
  ]);

  return {
    appointments,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

const getAppointmentById = async (appointmentId, userId, role) => {
  const appointment = await populateAppointment(Appointment.findById(appointmentId));

  if (!appointment) {
    throw { status: 404, message: "Appointment not found" };
  }

  if (role === "patient" && appointment.patient._id.toString() !== userId) {
    throw { status: 403, message: "Not authorized to view this appointment" };
  }

  if (role === "doctor") {
    const doctor = await findDoctorProfile(userId);
    if (!doctor || appointment.doctor._id.toString() !== doctor._id.toString()) {
      throw { status: 403, message: "Not authorized to view this appointment" };
    }
  }

  return appointment;
};

const updateAppointmentStatus = async (appointmentId, newStatus, userId, role) => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw { status: 404, message: "Appointment not found" };
  }

  if (role === "patient") {
    if (appointment.patient.toString() !== userId) {
      throw { status: 403, message: "Not authorized" };
    }
    if (newStatus !== "cancelled") {
      throw { status: 403, message: "Patients can only cancel appointments" };
    }
  } else if (role === "doctor") {
    const doctor = await findDoctorProfile(userId);
    if (!doctor || appointment.doctor.toString() !== doctor._id.toString()) {
      throw { status: 403, message: "Not authorized" };
    }
  } else {
    throw { status: 403, message: "Not authorized" };
  }

  const allowed = ALLOWED_TRANSITIONS[appointment.status] || [];
  if (!allowed.includes(newStatus)) {
    throw {
      status: 400,
      message: `Cannot change status from ${appointment.status} to ${newStatus}`,
    };
  }

  const previousStatus = appointment.status;
  appointment.status = newStatus;
  await appointment.save();

  if (newStatus === "cancelled" && previousStatus !== "cancelled") {
    await Availability.findByIdAndUpdate(appointment.availability, {
      $set: { isBooked: false },
    });
  }

  return populateAppointment(Appointment.findById(appointment._id));
};

const cancelAppointment = (appointmentId, userId, role) =>
  updateAppointmentStatus(appointmentId, "cancelled", userId, role);

module.exports = {
  bookAppointment,
  getMyAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  cancelAppointment,
};
