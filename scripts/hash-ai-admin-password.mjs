import { randomBytes, scryptSync } from "node:crypto";
import { Buffer } from "node:buffer";

// Read the secret from stdin so it never appears in argv or shell history.
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const password = Buffer.concat(chunks)
  .toString("utf8")
  .replace(/\r?\n$/, "");
if (password.length < 16 || password.length > 256) {
  process.stderr.write("Use an administrator password of 16 to 256 characters.\n");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1 });
process.stdout.write(`scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}\n`);
