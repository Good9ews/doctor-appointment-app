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
    email: `recur-${Date.now()}-${emailCounter++}@example.com`,
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
    email: `recdoc-${Date.now()}-${emailCounter++}@example.com`,
    phone: "+15551234567",
    location: "Princeton",
    image: "https://example.com/house.jpg",
  });

const setup = async () => {
  const doctorUser = await makeUser("doctor");
  const profile = await makeProfile(doctorUser);
  return { doctorUser, doctorToken: tokenFor(doctorUser), profile };
};

// Next date strictly in the future falling on weekday n (0 = Sunday).
const nextWeekday = (n, weeksOut = 0) => {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  d.setDate(d.getDate() + 1 + weeksOut * 7);
  while (d.getDay() !== n) {
    d.setDate(d.getDate() + 1);
  }
  return d;
};

const recurringBody = (doctorId, overrides = {}) => {
  const start = nextWeekday(1); // Monday
  const end = new Date(start);
  end.setDate(end.getDate() + 13); // two full Mon-Fri weeks
  return {
    doctor: doctorId.toString(),
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    daysOfWeek: [1, 3, 5],
    startTime: "09:00",
    endTime: "12:00",
    ...overrides,
  };
};

describe("POST /api/availability/recurring", () => {
  test("rejects unauthenticated requests with 401", async () => {
    const { profile } = await setup();
    const res = await request(app).post("/api/availability/recurring").send(recurringBody(profile._id));

    expect(res.status).toBe(401);
  });

  test("rejects patients with 403", async () => {
    const patient = await makeUser("patient");
    const { profile } = await setup();
    const res = await request(app)
      .post("/api/availability/recurring")
      .set(auth(tokenFor(patient)))
      .send(recurringBody(profile._id));

    expect(res.status).toBe(403);
  });

  test("rejects series for another doctor's profile with 403", async () => {
    const { doctorToken } = await setup();
    const otherUser = await makeUser("doctor");
    const otherProfile = await makeProfile(otherUser);

    const res = await request(app)
      .post("/api/availability/recurring")
      .set(auth(doctorToken))
      .send(recurringBody(otherProfile._id));

    expect(res.status).toBe(403);
  });

  test("generates one slot per matching weekday (happy path)", async () => {
    const { doctorToken, profile } = await setup();
    const res = await request(app)
      .post("/api/availability/recurring")
      .set(auth(doctorToken))
      .send(recurringBody(profile._id));

    expect(res.status).toBe(201);
    expect(res.body.data.created.length).toBe(6); // Mon/Wed/Fri x 2 weeks
    expect(res.body.data.skipped.length).toBe(0);

    const seriesIds = new Set(res.body.data.created.map((s) => s.seriesId));
    expect(seriesIds.size).toBe(1);

    const days = res.body.data.created.map((s) => new Date(s.date).getDay()).sort();
    expect(days).toEqual([1, 1, 3, 3, 5, 5]);

    expect(await Availability.countDocuments({})).toBe(6);
  });

  test("skips overlapping dates and reports them", async () => {
    const { doctorToken, profile } = await setup();
    const monday = nextWeekday(1);
    await Availability.create({
      doctor: profile._id,
      date: monday,
      startTime: "09:00",
      endTime: "10:00",
    });

    const res = await request(app)
      .post("/api/availability/recurring")
      .set(auth(doctorToken))
      .send(recurringBody(profile._id));

    expect(res.status).toBe(201);
    expect(res.body.data.created.length).toBe(5);
    expect(res.body.data.skipped.length).toBe(1);
    expect(new Date(res.body.data.skipped[0].date).getDay()).toBe(1);
  });

  test("dedupes repeated weekdays", async () => {
    const { doctorToken, profile } = await setup();
    const res = await request(app)
      .post("/api/availability/recurring")
      .set(auth(doctorToken))
      .send(recurringBody(profile._id, { daysOfWeek: [1, 1, 3, 3, 3] }));

    expect(res.status).toBe(201);
    expect(res.body.data.created.length).toBe(4); // Mon/Wed x 2 weeks
  });

  test("rejects invalid input with 400", async () => {
    const { doctorToken, profile } = await setup();
    const cases = [
      recurringBody(profile._id, { daysOfWeek: [] }),
      recurringBody(profile._id, { daysOfWeek: [7] }),
      recurringBody(profile._id, { daysOfWeek: ["mon"] }),
      recurringBody(profile._id, { startTime: "12:00", endTime: "09:00" }),
      recurringBody(profile._id, { startTime: "9am" }),
      recurringBody(profile._id, { doctor: "nope" }),
    ];

    // endDate before startDate.
    const reversed = recurringBody(profile._id);
    [reversed.startDate, reversed.endDate] = [reversed.endDate, reversed.startDate];
    cases.push(reversed);

    // Range over the 92-day cap.
    const far = new Date();
    far.setDate(far.getDate() + 200);
    cases.push(recurringBody(profile._id, { endDate: far.toISOString() }));

    for (const body of cases) {
      const res = await request(app)
        .post("/api/availability/recurring")
        .set(auth(doctorToken))
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  test("returns 404 for an unknown doctor id", async () => {
    const { doctorToken } = await setup();
    const res = await request(app)
      .post("/api/availability/recurring")
      .set(auth(doctorToken))
      .send(recurringBody(new mongoose.Types.ObjectId()));

    expect(res.status).toBe(404);
  });

  test("rejects ranges with no future matching dates with 400", async () => {
    const { doctorToken, profile } = await setup();
    const past = new Date();
    past.setDate(past.getDate() - 10);
    const pastEnd = new Date();
    pastEnd.setDate(pastEnd.getDate() - 3);

    const res = await request(app)
      .post("/api/availability/recurring")
      .set(auth(doctorToken))
      .send(recurringBody(profile._id, { startDate: past.toISOString(), endDate: pastEnd.toISOString() }));

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/availability/series/:seriesId", () => {
  const createSeries = async () => {
    const ctx = await setup();
    const created = await request(app)
      .post("/api/availability/recurring")
      .set(auth(ctx.doctorToken))
      .send(recurringBody(ctx.profile._id));
    return { ...ctx, seriesId: created.body.data.seriesId };
  };

  test("rejects unauthenticated requests with 401", async () => {
    const { seriesId } = await createSeries();
    const res = await request(app).delete(`/api/availability/series/${seriesId}`);

    expect(res.status).toBe(401);
  });

  test("rejects malformed ids with 400 and unknown series with 404", async () => {
    const { doctorToken } = await createSeries();

    const malformed = await request(app)
      .delete("/api/availability/series/nope")
      .set(auth(doctorToken));
    expect(malformed.status).toBe(400);

    const unknown = await request(app)
      .delete(`/api/availability/series/${new mongoose.Types.ObjectId()}`)
      .set(auth(doctorToken));
    expect(unknown.status).toBe(404);
  });

  test("rejects another doctor's series with 403", async () => {
    const { seriesId } = await createSeries();
    const otherUser = await makeUser("doctor");

    const res = await request(app)
      .delete(`/api/availability/series/${seriesId}`)
      .set(auth(tokenFor(otherUser)));

    expect(res.status).toBe(403);
  });

  test("deletes future unbooked slots but keeps booked and past ones", async () => {
    const { doctorToken, profile, seriesId } = await createSeries();
    const slots = await Availability.find({ seriesId }).sort({ date: 1 });

    // Book the first slot and add a past unbooked slot to the same series.
    await Availability.findByIdAndUpdate(slots[0]._id, { $set: { isBooked: true } });
    const past = new Date();
    past.setDate(past.getDate() - 5);
    await Availability.create({
      doctor: profile._id,
      date: past,
      startTime: "09:00",
      endTime: "10:00",
      seriesId,
    });

    const res = await request(app)
      .delete(`/api/availability/series/${seriesId}`)
      .set(auth(doctorToken));

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(5);
    expect(res.body.data.retainedBooked).toBe(1);
    expect(await Availability.countDocuments({ seriesId })).toBe(2);
  });
});
