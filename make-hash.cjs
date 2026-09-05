const crypto = require("node:crypto");

const password = process.argv[2];

if (!password) {
  console.error('Usage: node make-hash.cjs "PasswordAnda"');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("base64url");

const hash = crypto.scryptSync(
  password,
  salt,
  64,
  {
    N: 16384,
    r: 8,
    p: 1
  }
).toString("hex");

console.log("PASSWORD:");
console.log(password);
console.log("");
console.log("HASH:");
console.log(`scrypt$16384$8$1$${salt}$${hash}`);
