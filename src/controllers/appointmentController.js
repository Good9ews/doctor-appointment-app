const { validationResult } = require("express-validator");
const {
  bookAppointment,
  getMyAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  cancelAppointment,
} = require("../services/appointmentService");

const APPOINTMENT_DB_UNAVAILABLE = "Appointment database is unavailable right now.";

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

// Service functions throw plain { status, message } for expected failures
// (403/404/409 and business-rule 400s). Anything else is a genuine 500 whose
// text must never leak -- same policy as the terminal errorHandler.
const serviceErrorResponse = (res, error) => {
  if (error && typeof error.status === "number" && typeof error.message === "string") {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }
  return res.status(500).json({
    success: false,
    message: APPOINTMENT_DB_UNAVAILABLE,
  });
};

const book = async (req, res) => {
  if (validationErrorResponse(req, res)) {
    return undefined;
  }

  try {
    const appointment = await bookAppointment(req.user._id.toString(), req.body);
    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      data: appointment,
    });
  } catch (error) {
    return serviceErrorResponse(res, error);
  }
};

const listMine = async (req, res) => {
  if (validationErrorResponse(req, res)) {
    return undefined;
  }

  try {
    const result = await getMyAppointments(req.user._id.toString(), req.user.role, {
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.status(200).json({
      success: true,
      count: result.appointments.length,
      pagination: result.pagination,
      data: result.appointments,
    });
  } catch (error) {
    return serviceErrorResponse(res, error);
  }
};

const getOne = async (req, res) => {
  if (validationErrorResponse(req, res)) {
    return undefined;
  }

  try {
    const appointment = await getAppointmentById(
      req.params.id,
      req.user._id.toString(),
      req.user.role,
    );
    return res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    return serviceErrorResponse(res, error);
  }
};

const updateStatus = async (req, res) => {
  if (validationErrorResponse(req, res)) {
    return undefined;
  }

  try {
    const appointment = await updateAppointmentStatus(
      req.params.id,
      req.body.status,
      req.user._id.toString(),
      req.user.role,
    );
    return res.status(200).json({
      success: true,
      message: "Appointment status updated successfully",
      data: appointment,
    });
  } catch (error) {
    return serviceErrorResponse(res, error);
  }
};

const cancel = async (req, res) => {
  if (validationErrorResponse(req, res)) {
    return undefined;
  }

  try {
    const appointment = await cancelAppointment(
      req.params.id,
      req.user._id.toString(),
      req.user.role,
    );
    return res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
      data: appointment,
    });
  } catch (error) {
    return serviceErrorResponse(res, error);
  }
};

module.exports = { book, listMine, getOne, updateStatus, cancel };
