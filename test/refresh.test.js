const assert = require("node:assert/strict");
const test = require("node:test");
const session = require("../src/utils/session");
const browser = require("../src/browser/login");

test("failed concurrent refresh preserves the previous session", async (t) => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const saved = { authToken: `x.${payload}.x`, userId: "fixture" };
  t.mock.method(session, "loadSession", () => saved);
  const clear = t.mock.method(session, "clearSession", () => {});
  const write = t.mock.method(session, "saveSession", () => {});
  const login = t.mock.method(browser, "browserLogin", async () => { throw Error("offline"); });
  const auth = require("../src/services/auth.service");
  await auth.init();
  await Promise.all([assert.rejects(auth.login(), /offline/), assert.rejects(auth.login(), /offline/)]);
  assert.equal(login.mock.callCount(), 1);
  assert.equal(clear.mock.callCount(), 0);
  assert.equal(write.mock.callCount(), 0);
  assert.equal(auth.getToken(), saved.authToken);
  assert.equal(auth.getUserId(), saved.userId);
});
