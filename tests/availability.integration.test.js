const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const User = require("../src/models/User");
const Doctor = require("../src/models/Doctor");
const Availability = require("../src/models/Availability");
const { signToken } = require("../src/services/token/jwt");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { serverSelectionTimeoutMS: 10000 });
}, 60000);

afterEach(async () => {
  await User.deleteMany({});
  await Doctor.deleteMany({});
  await Availability.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

let emailCounter = 0;
const makeUser = (role = "doctor") =>
  User.create({
    name: role === "doctor" ? "Greg House" : "Jane Patient",
    email: `avail-${Date.now()}-${emailCounter++}@example.com`,
    password: "correcthorsebattery",
    role,
  });

const tokenFor = (user) => signToken({ sub: user._id.toString(), role: user.role });
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const makeProfile = (user) =>
  Doctor.create({
    user: user._id,
    name: "Greg House",
    specialization: "Diagnostics",
    email: `doc-${Date.now()}-${emailCounter++}@example.com`,
    phone: "+15551234567",
    location: "Princeton",
  });

const futureDate = (daysAhead = 7) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
};

const validSlot = (doctorId, overrides = {}) => ({
  doctor: doctorId.toString(),
  date: futureDate(),
  startTime: "09:00",
  endTime: "12:00",
  ...overrides,
});

const setup = async () => {
  const doctorUser = await makeUser("doctor");
  const profile = await makeProfile(doctorUser);
  return { doctorUser, doctorToken: tokenFor(doctorUser), profile };
};

describe("POST /api/availability", () => {
  test("rejects unauthenticated requests with 401", async () => {
    const { profile } = await setup();
    const res = await request(app).post("/api/availability").send(validSlot(profile._id));

    expect(res.status).toBe(401);
  });

  test("rejects patients with 403", async () => {
    const patient = await makeUser("patient");
    const { profile } = await setup();
    const res = await request(app)
      .post("/api/availability")
      .set(auth(tokenFor(patient)))
      .send(validSlot(profile._id));

    expect(res.status).toBe(403);
  });

  test("creates a slot (happy path)", async () => {
    const { doctorToken, profile } = await setup();
    const res = await request(app)
      .post("/api/availability")
      .set(auth(doctorToken))
      .send(validSlot(profile._id));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isBooked).toBe(false);
  });

  test("rejects slots for another doctor's profile with 403", async () => {
    const { doctorToken } = await setup();
    const otherUser = await makeUser("doctor");
    const otherProfile = await makeProfile(otherUser);

    const res = await request(app)
      .post("/api/availability")
      .set(auth(doctorToken))
      .send(validSlot(otherProfile._id));

    expect(res.status).toBe(403);
  });

  test("rejects missing fields and bad time format with 400", async () => {
    const { doctorToken, profile } = await setup();

    const missing = await request(app)
      .post("/api/availability")
      .set(auth(doctorToken))
      .send({ doctor: profile._id.toString() });
    expect(missing.status).toBe(400);

    const badTime = await request(app)
      .post("/api/availability")
      .set(auth(doctorToken))
      .send(validSlot(profile._id, { startTime: "9am" }));
    expect(badTime.status).toBe(400);
  });

  test("rejects end time before start time with 400", async () => {
    const { doctorToken, profile } = await setup();
    const res = await request(app)
      .post("/api/availability")
      .set(auth(doctorToken))
      .send(validSlot(profile._id, { startTime: "12:00", endTime: "09:00" }));

    expect(res.status).toBe(400);
  });

  test("rejects past dates with 400", async () => {
    const { doctorToken, profile } = await setup();
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const res = await request(app)
      .post("/api/availability")
      .set(auth(doctorToken))
      .send(validSlot(profile._id, { date: past.toISOString() }));

    expect(res.status).toBe(400);
  });

  test("rejects overlapping slots with 409, allows adjacent ones", async () => {
    const { doctorToken, profile } = await setup();
    await request(app)
      .post("/api/availability")
      .set(auth(doctorToken))
      .send(validSlot(profile._id, { startTime: "09:00", endTime: "10:00" }));

    const overlap = await request(app)
      .post("/api/availability")
      .set(auth(doctorToken))
      .send(validSlot(profile._id, { startTime: "09:30", endTime: "10:30" }));
    expect(overlap.status).toBe(409);

    const adjacent = await request(app)
      .post("/api/availability")
      .set(auth(doctorToken))
      .send(validSlot(profile._id, { startTime: "10:00", endTime: "11:00" }));
    expect(adjacent.status).toBe(201);
  });

  test("same time on a different date is allowed", async () => {
    const { doctorToken, profile } = await setup();
    await request(app)
      .post("/api/availability")
      .set(auth(doctorToken))
      .send(validSlot(profile._id));

    const otherDay = new Date();
    otherDay.setDate(otherDay.getDate() + 8);
    const res = await request(app)
      .post("/api/availability")
      .set(auth(doctorToken))
      .send(validSlot(profile._id, { date: otherDay.toISOString() }));

    expect(res.status).toBe(201);
  });

  test("returns 404 for an unknown doctor id", async () => {
    const { doctorToken } = await setup();
    const res = await request(app)
      .post("/api/availability")
      .set(auth(doctorToken))
      .send(validSlot(new mongoose.Types.ObjectId()));

    expect(res.status).toBe(404);
  });
});

describe("GET /api/availability/doctor/:doctorId", () => {
  test("rejects malformed ids with 400 (no 500 CastError)", async () => {
    const res = await request(app).get("/api/availability/doctor/nope");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("invalid doctor id");
  });

  test("returns 404 for unknown doctors, slots for known ones", async () => {
    const { doctorToken, profile } = await setup();

    const unknown = await request(app).get(
      `/api/availability/doctor/${new mongoose.Types.ObjectId()}`,
    );
    expect(unknown.status).toBe(404);

    await request(app)
      .post("/api/availability")
      .set(auth(doctorToken))
      .send(validSlot(profile._id));

    const res = await request(app).get(`/api/availability/doctor/${profile._id}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
  });

  test("reads stay public (no token required)", async () => {
    const { profile } = await setup();
    await Availability.create({
      doctor: profile._id,
      date: futureDate(),
      startTime: "09:00",
      endTime: "10:00",
    });

    const res = await request(app).get("/api/availability");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });
});
