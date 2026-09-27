const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const appointmentService = require("../../services/appointmentService");
const Appointment = require("../../models/Appointment");
const Availability = require("../../models/Availability");
const Doctor = require("../../models/Doctor");
const User = require("../../models/User");

let mongoServer;

// ---------- helpers ----------
const createPatient = async (overrides = {}) => {
  return User.create({
    name: "John Patient",
    email: `patient_${Date.now()}@test.com`,
    password: "Password123!",
    role: "patient",
    ...overrides,
  });
};

const createDoctor = async (overrides = {}) => {
  const user = await User.create({
    name: "Dr. Smith",
    email: `doctor_${Date.now()}@test.com`,
    password: "Password123!",
    role: "doctor",
    ...overrides,
  });

  return Doctor.create({
    user: user._id,
    specialization: "Cardiology",
    // add any other required fields from your Doctor model
  });
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

// ---------- setup / teardown ----------
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

// ---------- tests ----------
describe("appointmentService", () => {
  describe("bookAppointment", () => {
    it("should successfully book an appointment and mark availability as booked", async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
      const availability = await createAvailability(doctor._id);

      const data = {
        doctorId: doctor._id.toString(),
        availabilityId: availability._id.toString(),
        appointmentDate: "2025-10-15",
        startTime: "10:00",
        endTime: "10:30",
      };

      const appointment = await appointmentService.bookAppointment(
        patient._id.toString(),
        data
      );

      expect(appointment).toBeDefined();
      expect(appointment.status).toBe("pending");
      expect(appointment.patient._id.toString()).toBe(patient._id.toString());
      expect(appointment.doctor._id.toString()).toBe(doctor._id.toString());
      expect(appointment.startTime).toBe("10:00");
      expect(appointment.endTime).toBe("10:30");

      const updatedAvailability = await Availability.findById(availability._id);
      expect(updatedAvailability.isBooked).toBe(true);
    });

    it("should throw 403 if user is not a patient", async () => {
      const doctorUser = await User.create({
        name: "Dr. Fake",
        email: `fake_${Date.now()}@test.com`,
        password: "Password123!",
        role: "doctor",
      });
      const doctor = await createDoctor();
      const availability = await createAvailability(doctor._id);

      await expect(
        appointmentService.bookAppointment(doctorUser._id.toString(), {
          doctorId: doctor._id.toString(),
          availabilityId: availability._id.toString(),
          appointmentDate: "2025-10-15",
          startTime: "10:00",
          endTime: "10:30",
        })
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringMatching(/only patients/i),
      });
    });

    it("should throw 404 if doctor is not found", async () => {
      const patient = await createPatient();
      const fakeDoctorId = new mongoose.Types.ObjectId();

      await expect(
        appointmentService.bookAppointment(patient._id.toString(), {
          doctorId: fakeDoctorId.toString(),
          availabilityId: new mongoose.Types.ObjectId().toString(),
          appointmentDate: "2025-10-15",
          startTime: "10:00",
          endTime: "10:30",
        })
      ).rejects.toMatchObject({
        status: 404,
        message: expect.stringMatching(/doctor not found/i),
      });
    });

    it("should throw 404 if availability is not found", async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();

      await expect(
        appointmentService.bookAppointment(patient._id.toString(), {
          doctorId: doctor._id.toString(),
          availabilityId: new mongoose.Types.ObjectId().toString(),
          appointmentDate: "2025-10-15",
          startTime: "10:00",
          endTime: "10:30",
        })
      ).rejects.toMatchObject({
        status: 404,
        message: expect.stringMatching(/availability.*not found/i),
      });
    });

    it("should throw 400 if availability belongs to a different doctor", async () => {
      const patient = await createPatient();
      const doctor1 = await createDoctor();
      const doctor2 = await createDoctor();
      const availability = await createAvailability(doctor2._id);

      await expect(
        appointmentService.bookAppointment(patient._id.toString(), {
          doctorId: doctor1._id.toString(),
          availabilityId: availability._id.toString(),
          appointmentDate: "2025-10-15",
          startTime: "10:00",
          endTime: "10:30",
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringMatching(/does not belong/i),
      });
    });

    it("should throw 409 if availability is already booked", async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
      const availability = await createAvailability(doctor._id, {
        isBooked: true,
      });

      await expect(
        appointmentService.bookAppointment(patient._id.toString(), {
          doctorId: doctor._id.toString(),
          availabilityId: availability._id.toString(),
          appointmentDate: "2025-10-15",
          startTime: "10:00",
          endTime: "10:30",
        })
      ).rejects.toMatchObject({
        status: 409,
        message: expect.stringMatching(/already booked/i),
      });
    });

    it("should throw 400 if end time is before start time", async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
      const availability = await createAvailability(doctor._id);

      await expect(
        appointmentService.bookAppointment(patient._id.toString(), {
          doctorId: doctor._id.toString(),
          availabilityId: availability._id.toString(),
          appointmentDate: "2025-10-15",
          startTime: "11:00",
          endTime: "10:00",
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringMatching(/end time must be after start time/i),
      });
    });

    it("should throw 400 if time is outside the availability window", async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
      const availability = await createAvailability(doctor._id, {
        startTime: "09:00",
        endTime: "12:00",
      });

      await expect(
        appointmentService.bookAppointment(patient._id.toString(), {
          doctorId: doctor._id.toString(),
          availabilityId: availability._id.toString(),
          appointmentDate: "2025-10-15",
          startTime: "13:00",
          endTime: "13:30",
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringMatching(/outside the doctor's availability/i),
      });
    });

    it("should throw 409 on conflicting appointment (same doctor + overlapping time)", async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
      const availability = await createAvailability(doctor._id);

      // Existing active appointment
      await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        availability: availability._id,
        appointmentDate: new Date("2025-10-15"),
        startTime: "10:00",
        endTime: "10:30",
        status: "pending",
      });

      // Keep isBooked false so we reach the conflict check
      await Availability.findByIdAndUpdate(availability._id, {
        isBooked: false,
      });

      await expect(
        appointmentService.bookAppointment(patient._id.toString(), {
          doctorId: doctor._id.toString(),
          availabilityId: availability._id.toString(),
          appointmentDate: "2025-10-15",
          startTime: "10:15",
          endTime: "10:45",
        })
      ).rejects.toMatchObject({
        status: 409,
        message: expect.stringMatching(/already booked|conflict/i),
      });
    });

    it("should throw 409 if patient already has an overlapping appointment", async () => {
      const patient = await createPatient();
      const doctor1 = await createDoctor();
      const doctor2 = await createDoctor();
      const availability1 = await createAvailability(doctor1._id);
      const availability2 = await createAvailability(doctor2._id);

      // Patient already has an appointment with doctor1
      await Appointment.create({
        patient: patient._id,
        doctor: doctor1._id,
        availability: availability1._id,
        appointmentDate: new Date("2025-10-15"),
        startTime: "10:00",
        endTime: "10:30",
        status: "confirmed",
      });

      await expect(
        appointmentService.bookAppointment(patient._id.toString(), {
          doctorId: doctor2._id.toString(),
          availabilityId: availability2._id.toString(),
          appointmentDate: "2025-10-15",
          startTime: "10:15",
          endTime: "10:45",
        })
      ).rejects.toMatchObject({
        status: 409,
        message: expect.stringMatching(/already have an appointment/i),
      });
    });
  });

  describe("getMyAppointments", () => {
    it("should return appointments for a patient", async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
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

      const result = await appointmentService.getMyAppointments(
        patient._id.toString(),
        "patient"
      );

      expect(result.appointments).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it("should return appointments for a doctor", async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
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

      // doctor.user is the User id
      const result = await appointmentService.getMyAppointments(
        doctor.user.toString(),
        "doctor"
      );

      expect(result.appointments).toHaveLength(1);
    });

    it("should filter by status", async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
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

      const result = await appointmentService.getMyAppointments(
        patient._id.toString(),
        "patient",
        { status: "pending" }
      );

      expect(result.appointments).toHaveLength(1);
      expect(result.appointments[0].status).toBe("pending");
    });
  });

  describe("getAppointmentById", () => {
    it("should return the appointment for the owning patient", async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
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

      const result = await appointmentService.getAppointmentById(
        appointment._id.toString(),
        patient._id.toString(),
        "patient"
      );

      expect(result._id.toString()).toBe(appointment._id.toString());
    });

    it("should throw 404 for non-existent appointment", async () => {
      const patient = await createPatient();

      await expect(
        appointmentService.getAppointmentById(
          new mongoose.Types.ObjectId().toString(),
          patient._id.toString(),
          "patient"
        )
      ).rejects.toMatchObject({
        status: 404,
        message: expect.stringMatching(/not found/i),
      });
    });

    it("should throw 403 if patient tries to access another patient's appointment", async () => {
      const patient1 = await createPatient();
      const patient2 = await createPatient();
      const doctor = await createDoctor();
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

      await expect(
        appointmentService.getAppointmentById(
          appointment._id.toString(),
          patient2._id.toString(),
          "patient"
        )
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringMatching(/not authorized/i),
      });
    });
  });

  describe("updateAppointmentStatus / cancelAppointment", () => {
    it("should allow patient to cancel their appointment and free the availability", async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
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

      const result = await appointmentService.cancelAppointment(
        appointment._id.toString(),
        patient._id.toString(),
        "patient"
      );

      expect(result.status).toBe("cancelled");

      const updatedAvailability = await Availability.findById(availability._id);
      expect(updatedAvailability.isBooked).toBe(false);
    });

    it("should allow doctor to confirm an appointment", async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
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

      const result = await appointmentService.updateAppointmentStatus(
        appointment._id.toString(),
        "confirmed",
        doctor.user.toString(), // user id linked to the doctor
        "doctor"
      );

      expect(result.status).toBe("confirmed");
    });

    it("should throw 403 if patient tries to set status other than cancelled", async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
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

      await expect(
        appointmentService.updateAppointmentStatus(
          appointment._id.toString(),
          "confirmed",
          patient._id.toString(),
          "patient"
        )
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringMatching(/only cancel/i),
      });
    });

    it("should throw 400 when trying to change a completed/cancelled appointment", async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
      const availability = await createAvailability(doctor._id);

      const appointment = await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        availability: availability._id,
        appointmentDate: new Date("2025-10-15"),
        startTime: "10:00",
        endTime: "10:30",
        status: "completed",
      });

      await expect(
        appointmentService.updateAppointmentStatus(
          appointment._id.toString(),
          "cancelled",
          doctor.user.toString(),
          "doctor"
        )
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringMatching(/cannot change status/i),
      });
    });

    it("should throw 404 when updating a non-existent appointment", async () => {
      const patient = await createPatient();

      await expect(
        appointmentService.updateAppointmentStatus(
          new mongoose.Types.ObjectId().toString(),
          "cancelled",
          patient._id.toString(),
          "patient"
        )
      ).rejects.toMatchObject({
        status: 404,
        message: expect.stringMatching(/not found/i),
      });
    });
  });
});
