const { hashPassword, comparePassword } = require("../../src/services/password/hash");

describe("password service", () => {
  test("hashes a password to a different string", async () => {
    const hash = await hashPassword("Sup3rSecret!");
    expect(hash).not.toEqual("Sup3rSecret!");
    expect(hash.length).toBeGreaterThan(0);
  });

  test("comparePassword returns true for the matching plaintext", async () => {
    const hash = await hashPassword("Sup3rSecret!");
    await expect(comparePassword("Sup3rSecret!", hash)).resolves.toBe(true);
  });

  test("comparePassword returns false for a non-matching plaintext", async () => {
    const hash = await hashPassword("Sup3rSecret!");
    await expect(comparePassword("WrongPassword!", hash)).resolves.toBe(false);
  });

  test("hashing the same password twice yields different hashes (salted)", async () => {
    const hashA = await hashPassword("Sup3rSecret!");
    const hashB = await hashPassword("Sup3rSecret!");
    expect(hashA).not.toEqual(hashB);
  });
});
