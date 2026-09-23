const { signToken, verifyToken } = require("../../src/services/token/jwt");

describe("jwt service", () => {
  test("signs a token that verifies back to the same payload", () => {
    const token = signToken({ sub: "user-123", role: "patient" });
    const decoded = verifyToken(token);

    expect(decoded.sub).toBe("user-123");
    expect(decoded.role).toBe("patient");
  });

  test("throws when verifying a garbage token", () => {
    expect(() => verifyToken("not-a-real-token")).toThrow();
  });

  test("throws when verifying a token signed with a different secret", () => {
    const jwt = require("jsonwebtoken");
    const foreignToken = jwt.sign({ sub: "user-123" }, "a-different-secret");

    expect(() => verifyToken(foreignToken)).toThrow();
  });

  test("throws when verifying an expired token", () => {
    const jwt = require("jsonwebtoken");
    const expiredToken = jwt.sign({ sub: "user-123" }, process.env.JWT_SECRET, {
      expiresIn: -1,
    });

    expect(() => verifyToken(expiredToken)).toThrow();
  });
});
