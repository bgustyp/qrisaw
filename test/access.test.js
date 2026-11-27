const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const express = require("express");
const client = require("../src/configs/saweria.config");
const auth = require("../src/services/auth.service");
const payments = require("../src/routes/payment.routes");
const users = require("../src/routes/user.routes");
const health = require("../src/routes/health.routes");

test("private routes fail closed; authorized balance and public status still work", async (t) => {
  const previous = process.env.ADMIN_KEY;
  t.after(() => {
    if (previous === undefined) delete process.env.ADMIN_KEY;
    else process.env.ADMIN_KEY = previous;
  });
  const upstream = t.mock.method(client, "get", async () => ({ data: { data: { balance: 123 } } }));
  const setSession = t.mock.method(auth, "setSession", () => {});
  const app = express();
  app.use(express.json());
  app.use("/api/payments", payments);
  app.use("/api/users", users);
  app.use("/health", health);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const [key, code] of [["", 403], ["test-key", 401]]) {
    process.env.ADMIN_KEY = key;
    for (const path of ["/api/payments/balance", "/api/payments/balance/available", "/api/payments/transactions", "/api/users", "/health/session"]) {
      const method = path === "/health/session" ? "POST" : "GET";
      assert.equal((await fetch(url + path, { method })).status, code, path);
    }
  }
  assert.equal(setSession.mock.callCount(), 0);
  assert.equal(upstream.mock.callCount(), 0);
  const headers = { "X-Admin-Key": "test-key" };
  for (const path of ["/api/payments/balance", "/api/payments/balance/available", "/api/payments/transactions", "/api/users"]) {
    assert.equal((await fetch(url + path, { headers })).status, 503, path);
  }
  assert.equal(upstream.mock.callCount(), 0);
  t.mock.method(auth, "requireUserId", () => "fixture");
  const balance = await fetch(`${url}/api/payments/balance`, { headers });
  assert.equal((await balance.json()).data.balance, 123);
  assert.equal((await fetch(`${url}/api/payments/bad-id/status`)).status, 400);
  assert.equal((await fetch(`${url}/api/payments/00000000-0000-4000-8000-000000000000/status`)).status, 200);
});
