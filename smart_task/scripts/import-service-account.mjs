/**
 * Copies a downloaded Firebase service-account JSON file into .env.local.
 *
 *   node scripts/import-service-account.mjs "C:/Users/you/Downloads/smart-task-xxxx.json"
 *
 * Doing it by hand is error-prone: the private key is a multi-line PEM that has
 * to survive as a single quoted line with literal \n escapes. This handles that.
 *
 * The JSON file is only read - nothing is uploaded anywhere. Delete it once the
 * import is done; .env.local is the only copy you need.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const jsonPath = process.argv[2];

if (!jsonPath) {
  console.error(
    "Usage: node scripts/import-service-account.mjs <path-to-service-account.json>",
  );
  process.exit(1);
}

if (!existsSync(jsonPath)) {
  console.error(`No file found at: ${jsonPath}`);
  process.exit(1);
}

let key;
try {
  key = JSON.parse(readFileSync(jsonPath, "utf8"));
} catch {
  console.error("That file is not valid JSON. Download the key again.");
  process.exit(1);
}

const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = key;

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "That JSON does not look like a service-account key (missing project_id, " +
      "client_email or private_key). Use Project settings -> Service accounts -> " +
      "Generate new private key.",
  );
  process.exit(1);
}

const envPath = new URL("../.env.local", import.meta.url);
if (!existsSync(envPath)) {
  console.error("No .env.local found. Copy .env.local.example to .env.local first.");
  process.exit(1);
}

let env = readFileSync(envPath, "utf8");

/** Replace the line for `name`, or append it if the key is not present. */
function setVar(source, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  return pattern.test(source) ? source.replace(pattern, line) : `${source}\n${line}\n`;
}

// Escape newlines so the PEM survives as one quoted line, the same shape Vercel
// and `node --env-file` both expect.
const escapedKey = privateKey.replace(/\n/g, "\\n");

env = setVar(env, "FIREBASE_PROJECT_ID", projectId);
env = setVar(env, "FIREBASE_CLIENT_EMAIL", clientEmail);
env = setVar(env, "FIREBASE_PRIVATE_KEY", `"${escapedKey}"`);

writeFileSync(envPath, env);

console.log(`
Imported into .env.local:

  FIREBASE_PROJECT_ID    ${projectId}
  FIREBASE_CLIENT_EMAIL  ${clientEmail}
  FIREBASE_PRIVATE_KEY   (${privateKey.length} characters, escaped)

You can now delete the downloaded JSON file - it is not needed again.
`);
