const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const launcher = require("puppeteer-real-browser");
const session = require("../src/utils/session");

test("sandbox denial stops browser retries and still permits manual sessions", async (t) => {
  process.env.SAWERIA_EMAIL = "fixture@example.invalid";
  process.env.SAWERIA_PASSWORD = "fixture";
  process.env.CHROME_PATH = "/fixture/chromium";
  if (process.getuid) t.mock.method(process, "getuid", () => 1000);
  const connect = t.mock.method(launcher, "connect", async ({ customConfig }) => {
    fs.writeFileSync(path.join(customConfig.userDataDir, "chrome-err.log"),
      "Failed to move to new namespace: PID namespaces supported, but failed: errno = Operation not permitted");
    throw Object.assign(new Error("Local connection refused"), { code: "ECONNREFUSED" });
  });
  t.mock.method(session, "saveSession", () => {});
  const auth = require("../src/services/auth.service");
  const expected = { code: "CHROMIUM_SANDBOX_UNAVAILABLE", statusCode: 503 };
  await assert.rejects(auth.login(), expected);
  await assert.rejects(auth.login(), expected);
  assert.equal(connect.mock.callCount(), 1);
  assert.equal(auth.getAuthStatus().browserLoginError, expected.code);
  assert.throws(() => auth.requireUserId(), expected);
  auth.setSession("fixture", "manual-user");
  assert.equal(auth.requireUserId(), "manual-user");
});
