const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../app");
const { connect, closeDatabase, clearDatabase } = require("../setup");

const User = require("../../models/User");
const Doctor = require("../../models/Doctor");
const Availability = require("../../models/Availability");
const Appointment = require("../../models/Appointment");

// Use your existing JWT service
const { signToken } = require("../../services/token/jwt");   // adjust if the export name is different

// ---------- helpers ----------
const createPatient = async (overrides = {}) => {
  const patient = await User.create({
    name: "John Patient",
    email: `patient_${Date.now()}@test.com`,
    password: "Password123!",
    role: "patient",
    ...overrides,
  });

  // Use your existing signToken
  const token = signToken(patient._id);   // or signToken({ id: patient._id }) depending on your implementation
  return { patient, token };
};

const createDoctorUser = async (overrides = {}) => {
  const user = await User.create({
    name: "Dr. Smith",
    email: `doctor_${Date.now()}@test.com`,
    password: "Password123!",
    role: "doctor",
    ...overrides,
  });

  const doctor = await Doctor.create({
    user: user._id,
    specialization: "Cardiology",
    // add other required fields if needed
  });

  const token = signToken(user._id);   // same as above
  return { user, doctor, token };
};

const createAvailability = async (doctorId, overrides = {}) => {
  return Availability.create({
    doctor: doctorId,
    date: new Date("2025-10-15"),
    startTime: "09:00",
    endTime: "17:00",
    isBooked: false,
    ...overrides,
  });
};


// ---------- test suite ----------
describe("Appointment API", () => {
  beforeAll(async () => {
    await connect();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  // ============================================================
  // POST /api/appointments  (Booking)
  // ============================================================
  describe("POST /api/appointments", () => {
    it("should book an appointment successfully", async () => {
      const { patient, token } = await createPatient();
      const { doctor } = await createDoctorUser();
      const availability = await createAvailability(doctor._id);

      const payload = {
        doctorId: doctor._id.toString(),
        availabilityId: availability._id.toString(),
        appointmentDate: "2025-10-15",
        startTime: "10:00",
        endTime: "10:30",
      };

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${token}`)
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("_id");
      expect(res.body.data.status).toBe("pending");
      expect(res.body.data.patient._id || res.body.data.patient).toBeDefined();
      expect(res.body.data.doctor._id || res.body.data.doctor).toBeDefined();

      // Verify availability was marked as booked
      const updatedAvailability = await Availability.findById(availability._id);
      expect(updatedAvailability.isBooked).toBe(true);
    });

    it("should return 404 if doctor is not found", async () => {
      const { token } = await createPatient();
      const fakeDoctorId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${token}`)
        .send({
          doctorId: fakeDoctorId.toString(),
          availabilityId: new mongoose.Types.ObjectId().toString(),
          appointmentDate: "2025-10-15",
          startTime: "10:00",
          endTime: "10:30",
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toMatch(/doctor not found/i);
    });

    it("should return 404 if availability is not found", async () => {
      const { token } = await createPatient();
      const { doctor } = await createDoctorUser();
      const fakeAvailabilityId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${token}`)
        .send({
          doctorId: doctor._id.toString(),
          availabilityId: fakeAvailabilityId.toString(),
          appointmentDate: "2025-10-15",
          startTime: "10:00",
          endTime: "10:30",
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toMatch(/availability.*not found/i);
    });

    it("should return 400 if availability belongs to a different doctor", async () => {
      const { token } = await createPatient();
      const { doctor: doctor1 } = await createDoctorUser();
      const { doctor: doctor2 } = await createDoctorUser();
      const availability = await createAvailability(doctor2._id); // belongs to doctor2

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${token}`)
        .send({
          doctorId: doctor1._id.toString(), // trying to use with doctor1
          availabilityId: availability._id.toString(),
          appointmentDate: "2025-10-15",
          startTime: "10:00",
          endTime: "10:30",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/does not belong/i);
    });

    it("should return 409 if availability is already booked", async () => {
      const { token } = await createPatient();
      const { doctor } = await createDoctorUser();
      const availability = await createAvailability(doctor._id, {
        isBooked: true,
      });

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${token}`)
        .send({
          doctorId: doctor._id.toString(),
          availabilityId: availability._id.toString(),
          appointmentDate: "2025-10-15",
          startTime: "10:00",
          endTime: "10:30",
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toMatch(/already booked/i);
    });

    it("should return 400 for invalid start/end time (end before start)", async () => {
      const { token } = await createPatient();
      const { doctor } = await createDoctorUser();
      const availability = await createAvailability(doctor._id);

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${token}`)
        .send({
          doctorId: doctor._id.toString(),
          availabilityId: availability._id.toString(),
          appointmentDate: "2025-10-15",
          startTime: "11:00",
          endTime: "10:00", // invalid
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/end time must be after start time/i);
    });

    it("should return 400 if time is outside doctor's availability window", async () => {
      const { token } = await createPatient();
      const { doctor } = await createDoctorUser();
      const availability = await createAvailability(doctor._id, {
        startTime: "09:00",
        endTime: "12:00",
      });

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${token}`)
        .send({
          doctorId: doctor._id.toString(),
          availabilityId: availability._id.toString(),
          appointmentDate: "2025-10-15",
          startTime: "13:00", // outside
          endTime: "13:30",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/outside the doctor's availability/i);
    });

    it("should return 409 for conflicting appointment (same doctor + overlapping time)", async () => {
      const { patient, token } = await createPatient();
      const { doctor } = await createDoctorUser();
      const availability = await createAvailability(doctor._id);

      // Existing appointment
      await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        availability: availability._id,
        appointmentDate: new Date("2025-10-15"),
        startTime: "10:00",
        endTime: "10:30",
        status: "pending",
      });

      // Note: We mark isBooked false so the test reaches the conflict check
      // (in real flow the first booking would have set isBooked = true)
      await Availability.findByIdAndUpdate(availability._id, { isBooked: false });

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${token}`)
        .send({
          doctorId: doctor._id.toString(),
          availabilityId: availability._id.toString(),
          appointmentDate: "2025-10-15",
          startTime: "10:15", // overlaps
          endTime: "10:45",
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toMatch(/already booked|conflict/i);
    });

    it("should return 401 if no token is provided", async () => {
      const res = await request(app)
        .post("/api/appointments")
        .send({
          doctorId: new mongoose.Types.ObjectId().toString(),
          availabilityId: new mongoose.Types.ObjectId().toString(),
          appointmentDate: "2025-10-15",
          startTime: "10:00",
          endTime: "10:30",
        });

      expect(res.statusCode).toBe(401);
    });

    it("should return 403 if a doctor tries to book an appointment", async () => {
      const { token } = await createDoctorUser(); // doctor token
      const { doctor } = await createDoctorUser();
      const availability = await createAvailability(doctor._id);

      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", `Bearer ${token}`)
        .send({
          doctorId: doctor._id.toString(),
          availabilityId: availability._id.toString(),
          appointmentDate: "2025-10-15",
          startTime: "10:00",
          endTime: "10:30",
        });

      expect(res.statusCode).toBe(403);
    });
  });

  // ============================================================
  // GET /api/appointments
  // ============================================================
  describe("GET /api/appointments", () => {
    it("should return appointments for the logged-in patient", async () => {
      const { patient, token } = await createPatient();
      const { doctor } = await createDoctorUser();
      const availability = await createAvailability(doctor._id);

      await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        availability: availability._id,
        appointmentDate: new Date("2025-10-15"),
        startTime: "10:00",
        endTime: "10:30",
        status: "pending",
      });

      const res = await request(app)
        .get("/api/appointments")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.appointments).toHaveLength(1);
      expect(res.body.data.pagination).toBeDefined();
    });

    it("should return appointments for the logged-in doctor", async () => {
      const { patient } = await createPatient();
      const { user: doctorUser, doctor, token } = await createDoctorUser();
      const availability = await createAvailability(doctor._id);

      await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        availability: availability._id,
        appointmentDate: new Date("2025-10-15"),
        startTime: "10:00",
        endTime: "10:30",
        status: "confirmed",
      });

      const res = await request(app)
        .get("/api/appointments")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.appointments).toHaveLength(1);
    });

    it("should filter appointments by status", async () => {
      const { patient, token } = await createPatient();
      const { doctor } = await createDoctorUser();
      const availability = await createAvailability(doctor._id);

      await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        availability: availability._id,
        appointmentDate: new Date("2025-10-15"),
        startTime: "10:00",
        endTime: "10:30",
        status: "pending",
      });

      await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        availability: availability._id,
        appointmentDate: new Date("2025-10-16"),
        startTime: "11:00",
        endTime: "11:30",
        status: "confirmed",
      });

      const res = await request(app)
        .get("/api/appointments?status=pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.appointments).toHaveLength(1);
      expect(res.body.data.appointments[0].status).toBe("pending");
    });
  });

  // ============================================================
  // GET /api/appointments/:id
  // ============================================================
  describe("GET /api/appointments/:id", () => {
    it("should return a single appointment for the owner", async () => {
      const { patient, token } = await createPatient();
      const { doctor } = await createDoctorUser();
      const availability = await createAvailability(doctor._id);

      const appointment = await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        availability: availability._id,
        appointmentDate: new Date("2025-10-15"),
        startTime: "10:00",
        endTime: "10:30",
        status: "pending",
      });

      const res = await request(app)
        .get(`/api/appointments/${appointment._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data._id).toBe(appointment._id.toString());
    });

    it("should return 404 for invalid appointment ID", async () => {
      const { token } = await createPatient();
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/appointments/${fakeId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it("should return 403 if patient tries to access another patient's appointment", async () => {
      const { patient: patient1 } = await createPatient();
      const { token: token2 } = await createPatient(); // different patient
      const { doctor } = await createDoctorUser();
      const availability = await createAvailability(doctor._id);

      const appointment = await Appointment.create({
        patient: patient1._id,
        doctor: doctor._id,
        availability: availability._id,
        appointmentDate: new Date("2025-10-15"),
        startTime: "10:00",
        endTime: "10:30",
        status: "pending",
      });

      const res = await request(app)
        .get(`/api/appointments/${appointment._id}`)
        .set("Authorization", `Bearer ${token2}`);

      expect(res.statusCode).toBe(403);
    });
  });

  // ============================================================
  // PATCH /api/appointments/:id/status  &  /cancel
  // ============================================================
  describe("PATCH /api/appointments/:id/status and cancel", () => {
    it("should allow patient to cancel their own appointment", async () => {
      const { patient, token } = await createPatient();
      const { doctor } = await createDoctorUser();
      const availability = await createAvailability(doctor._id, {
        isBooked: true,
      });

      const appointment = await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        availability: availability._id,
        appointmentDate: new Date("2025-10-15"),
        startTime: "10:00",
        endTime: "10:30",
        status: "pending",
      });

      const res = await request(app)
        .patch(`/api/appointments/${appointment._id}/cancel`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe("cancelled");

      // Availability should be freed
      const updatedAvailability = await Availability.findById(availability._id);
      expect(updatedAvailability.isBooked).toBe(false);
    });

    it("should allow doctor to confirm an appointment", async () => {
      const { patient } = await createPatient();
      const { doctor, token } = await createDoctorUser();
      const availability = await createAvailability(doctor._id);

      const appointment = await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        availability: availability._id,
        appointmentDate: new Date("2025-10-15"),
        startTime: "10:00",
        endTime: "10:30",
        status: "pending",
      });

      const res = await request(app)
        .patch(`/api/appointments/${appointment._id}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "confirmed" });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe("confirmed");
    });

    it("should return 403 if patient tries to set status to confirmed", async () => {
      const { patient, token } = await createPatient();
      const { doctor } = await createDoctorUser();
      const availability = await createAvailability(doctor._id);

      const appointment = await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        availability: availability._id,
        appointmentDate: new Date("2025-10-15"),
        startTime: "10:00",
        endTime: "10:30",
        status: "pending",
      });

      const res = await request(app)
        .patch(`/api/appointments/${appointment._id}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "confirmed" });

      expect(res.statusCode).toBe(403);
    });

    it("should return 404 when updating a non-existent appointment", async () => {
      const { token } = await createPatient();
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .patch(`/api/appointments/${fakeId}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "cancelled" });

      expect(res.statusCode).toBe(404);
    });
  });
});
