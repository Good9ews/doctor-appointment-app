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

describe("PUT /api/availability/:id", () => {
  const createSlot = async () => {
    const ctx = await setup();
    const created = await request(app)
      .post("/api/availability")
      .set(auth(ctx.doctorToken))
      .send(validSlot(ctx.profile._id, { startTime: "09:00", endTime: "10:00" }));
    return { ...ctx, slotId: created.body.data._id };
  };

  test("rejects unauthenticated requests with 401", async () => {
    const { slotId } = await createSlot();
    const res = await request(app).put(`/api/availability/${slotId}`).send({ startTime: "09:30" });

    expect(res.status).toBe(401);
  });

  test("rejects malformed ids with 400", async () => {
    const { doctorToken } = await setup();
    const res = await request(app)
      .put("/api/availability/nope")
      .set(auth(doctorToken))
      .send({ startTime: "09:30" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("invalid availability id");
  });

  test("returns 404 for unknown ids", async () => {
    const { doctorToken } = await setup();
    const res = await request(app)
      .put(`/api/availability/${new mongoose.Types.ObjectId()}`)
      .set(auth(doctorToken))
      .send({ startTime: "09:30" });

    expect(res.status).toBe(404);
  });

  test("rejects editing another doctor's slot with 403", async () => {
    const { slotId } = await createSlot();
    const otherUser = await makeUser("doctor");
    const res = await request(app)
      .put(`/api/availability/${slotId}`)
      .set(auth(tokenFor(otherUser)))
      .send({ startTime: "09:30" });

    expect(res.status).toBe(403);
  });

  test("updates times (happy path) and ignores self in overlap check", async () => {
    const { doctorToken, slotId } = await createSlot();

    // Same values must not clash with itself.
    const noop = await request(app)
      .put(`/api/availability/${slotId}`)
      .set(auth(doctorToken))
      .send({ startTime: "09:00", endTime: "10:00" });
    expect(noop.status).toBe(200);

    const res = await request(app)
      .put(`/api/availability/${slotId}`)
      .set(auth(doctorToken))
      .send({ startTime: "09:30", endTime: "10:30" });
    expect(res.status).toBe(200);
    expect(res.body.data.startTime).toBe("09:30");
  });

  test("rejects a move that overlaps another slot with 409", async () => {
    const { doctorToken, profile, slotId } = await createSlot();
    await request(app)
      .post("/api/availability")
      .set(auth(doctorToken))
      .send(validSlot(profile._id, { startTime: "11:00", endTime: "12:00" }));

    const res = await request(app)
      .put(`/api/availability/${slotId}`)
      .set(auth(doctorToken))
      .send({ startTime: "10:30", endTime: "11:30" });

    expect(res.status).toBe(409);
  });

  test("rejects bad times and past dates with 400", async () => {
    const { doctorToken, slotId } = await createSlot();

    const badOrder = await request(app)
      .put(`/api/availability/${slotId}`)
      .set(auth(doctorToken))
      .send({ startTime: "10:00", endTime: "09:00" });
    expect(badOrder.status).toBe(400);

    const badFormat = await request(app)
      .put(`/api/availability/${slotId}`)
      .set(auth(doctorToken))
      .send({ startTime: "morning" });
    expect(badFormat.status).toBe(400);

    const past = new Date();
    past.setDate(past.getDate() - 1);
    const pastDate = await request(app)
      .put(`/api/availability/${slotId}`)
      .set(auth(doctorToken))
      .send({ date: past.toISOString() });
    expect(pastDate.status).toBe(400);
  });

  test("rejects editing a booked slot with 409", async () => {
    const { doctorToken, slotId } = await createSlot();
    await Availability.findByIdAndUpdate(slotId, { $set: { isBooked: true } });

    const res = await request(app)
      .put(`/api/availability/${slotId}`)
      .set(auth(doctorToken))
      .send({ startTime: "09:30" });

    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/availability/:id", () => {
  test("rejects unauthenticated requests with 401", async () => {
    const { profile } = await setup();
    const slot = await Availability.create({
      doctor: profile._id,
      date: futureDate(),
      startTime: "09:00",
      endTime: "10:00",
    });

    const res = await request(app).delete(`/api/availability/${slot._id}`);
    expect(res.status).toBe(401);
  });

  test("rejects malformed ids with 400 and unknown ids with 404", async () => {
    const { doctorToken } = await setup();

    const malformed = await request(app)
      .delete("/api/availability/nope")
      .set(auth(doctorToken));
    expect(malformed.status).toBe(400);

    const unknown = await request(app)
      .delete(`/api/availability/${new mongoose.Types.ObjectId()}`)
      .set(auth(doctorToken));
    expect(unknown.status).toBe(404);
  });

  test("rejects deleting another doctor's slot with 403", async () => {
    const { profile } = await setup();
    const slot = await Availability.create({
      doctor: profile._id,
      date: futureDate(),
      startTime: "09:00",
      endTime: "10:00",
    });
    const otherUser = await makeUser("doctor");

    const res = await request(app)
      .delete(`/api/availability/${slot._id}`)
      .set(auth(tokenFor(otherUser)));
    expect(res.status).toBe(403);
  });

  test("rejects deleting a booked slot with 409", async () => {
    const { doctorToken, profile } = await setup();
    const slot = await Availability.create({
      doctor: profile._id,
      date: futureDate(),
      startTime: "09:00",
      endTime: "10:00",
      isBooked: true,
    });

    const res = await request(app)
      .delete(`/api/availability/${slot._id}`)
      .set(auth(doctorToken));
    expect(res.status).toBe(409);
    expect(await Availability.findById(slot._id)).not.toBeNull();
  });

  test("deletes an unbooked slot (happy path)", async () => {
    const { doctorToken, profile } = await setup();
    const slot = await Availability.create({
      doctor: profile._id,
      date: futureDate(),
      startTime: "09:00",
      endTime: "10:00",
    });

    const res = await request(app)
      .delete(`/api/availability/${slot._id}`)
      .set(auth(doctorToken));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(await Availability.findById(slot._id)).toBeNull();
  });
});
