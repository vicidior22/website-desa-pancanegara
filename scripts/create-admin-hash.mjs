import crypto from "node:crypto";
const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run admin:hash -- "PasswordAnda"');
  process.exit(1);
}
const salt = crypto.randomBytes(16).toString("base64url");
const N = 16384, r = 8, p = 1, keylen = 64;
crypto.scrypt(password, salt, keylen, { N, r, p, maxmem: 32 * 1024 * 1024 }, (err, derived) => {
  if (err) throw err;
  console.log(`ADMIN_PASSWORD_HASH=scrypt$${N}$${r}$${p}$${salt}$${derived.toString("base64url")}`);
});