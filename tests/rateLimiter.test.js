const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");

// Rate limiting is application-level singleton state keyed by IP, so this lives in its own
// test file: exhausting the limit here must not affect the login/register tests elsewhere.

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { serverSelectionTimeoutMS: 10000 });
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("login rate limiter", () => {
  test("blocks with 429 after 10 attempts from the same client", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "wrong-password" });
      expect(res.status).toBe(401);
    }

    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "wrong-password" });

    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
  }, 30000);
});

describe("register rate limiter", () => {
  test("blocks with 429 after 20 attempts from the same client", async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await request(app)
        .post("/api/auth/register")
        .send({ email: `flood-${attempt}@example.com`, password: "short" });
    }

    const blocked = await request(app)
      .post("/api/auth/register")
      .send({ email: "flood-final@example.com", password: "short" });

    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
  }, 30000);
});
