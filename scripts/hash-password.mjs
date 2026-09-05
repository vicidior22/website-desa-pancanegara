import crypto from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs YOUR_PASSWORD");
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");
const derived = await new Promise((resolve, reject) => {
  crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => {
    if (err) reject(err);
    else resolve(key);
  });
});

console.log(`scrypt$${salt}$${Buffer.from(derived).toString("hex")}`);
