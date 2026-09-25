const appointmentService = require("../services/appointmentService");
const { successResponse, errorResponse } = require("../utils/response"); // adjust to your response util

const bookAppointment = async (req, res, next) => {
  try {
    const appointment = await appointmentService.bookAppointment(
      req.user._id,
      req.body
    );

    return successResponse(res, 201, "Appointment booked successfully", appointment);
  } catch (error) {
    next(error); // goes to errorMiddleware
  }
};

const getMyAppointments = async (req, res, next) => {
  try {
    const result = await appointmentService.getMyAppointments(
      req.user._id,
      req.user.role,
      req.query
    );

    return successResponse(res, 200, "Appointments retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

const getAppointmentById = async (req, res, next) => {
  try {
    const appointment = await appointmentService.getAppointmentById(
      req.params.id,
      req.user._id,
      req.user.role
    );

    return successResponse(res, 200, "Appointment retrieved successfully", appointment);
  } catch (error) {
    next(error);
  }
};

const updateAppointmentStatus = async (req, res, next) => {
  try {
    const appointment = await appointmentService.updateAppointmentStatus(
      req.params.id,
      req.body.status,
      req.user._id,
      req.user.role
    );

    return successResponse(res, 200, "Appointment status updated", appointment);
  } catch (error) {
    next(error);
  }
};

const cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await appointmentService.cancelAppointment(
      req.params.id,
      req.user._id,
      req.user.role
    );

    return successResponse(res, 200, "Appointment cancelled successfully", appointment);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  bookAppointment,
  getMyAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  cancelAppointment,
};
