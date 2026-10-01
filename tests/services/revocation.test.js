const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { revokeToken, isTokenRevoked } = require("../../src/services/token/revocation");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { serverSelectionTimeoutMS: 10000 });
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("token revocation service", () => {
  test("a jti that was never revoked is not revoked", async () => {
    await expect(isTokenRevoked("never-seen-jti")).resolves.toBe(false);
  });

  test("revoking a jti makes isTokenRevoked return true", async () => {
    await revokeToken("some-jti", new Date(Date.now() + 60 * 60 * 1000));
    await expect(isTokenRevoked("some-jti")).resolves.toBe(true);
  });

  test("revoking the same jti twice does not throw (idempotent)", async () => {
    const jti = "duplicate-jti";
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await revokeToken(jti, expiresAt);
    await expect(revokeToken(jti, expiresAt)).resolves.toBeUndefined();
    await expect(isTokenRevoked(jti)).resolves.toBe(true);
  });

  test("revoking one jti does not affect another", async () => {
    await revokeToken("revoked-only-this-one", new Date(Date.now() + 60 * 60 * 1000));
    await expect(isTokenRevoked("untouched-jti")).resolves.toBe(false);
  });

  test("concurrent revocations of the same jti do not throw", async () => {
    const jti = "concurrent-jti";
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await expect(
      Promise.all([
        revokeToken(jti, expiresAt),
        revokeToken(jti, expiresAt),
        revokeToken(jti, expiresAt),
      ])
    ).resolves.toBeDefined();
    await expect(isTokenRevoked(jti)).resolves.toBe(true);
  });

  test("a missing or non-string jti is treated as revoked (fail closed), never a wildcard match", async () => {
    await expect(isTokenRevoked(undefined)).resolves.toBe(true);
    await expect(isTokenRevoked(null)).resolves.toBe(true);
    await expect(isTokenRevoked("")).resolves.toBe(true);
    await expect(isTokenRevoked({ $ne: null })).resolves.toBe(true);

    // Crucially, none of the above may have written a {jti: null} row that would then
    // match some other legitimate jti-less lookup.
    const count = await require("mongoose").model("RevokedToken").countDocuments({ jti: null });
    expect(count).toBe(0);
  });

  test("revokeToken rejects a missing or non-string jti instead of writing a shared null row", async () => {
    await expect(revokeToken(undefined, new Date())).rejects.toThrow();
    await expect(revokeToken(null, new Date())).rejects.toThrow();
    await expect(revokeToken("", new Date())).rejects.toThrow();
  });

  test("revokeToken rejects an invalid expiresAt", async () => {
    await expect(revokeToken("some-other-jti", "not-a-date")).rejects.toThrow();
    await expect(revokeToken("some-other-jti", new Date(NaN))).rejects.toThrow();
  });
});
