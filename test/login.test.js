const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const http = require("node:http");
const test = require("node:test");

test("manual session helper sends credentials only to the local endpoint and reports rejection", async (t) => {
  const token = "fixture-session-token";
  const key = "fixture-admin-key";
  let requests = 0;
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/health/session");
    assert.equal(req.headers["x-admin-key"], key);
    assert.deepEqual(JSON.parse(body), { userId: "fixture-id", authToken: token });
    res.writeHead(++requests === 1 ? 200 : 401).end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  for (const expected of [0, 1]) {
    const child = spawn("bash", ["src/login.sh"], {
      env: { PATH: process.env.PATH, ADMIN_KEY: key, PORT: String(server.address().port), DOTENV_CONFIG_PATH: "/dev/null" },
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { output += chunk; });
    child.stdin.end(`fixture-id\n${token}\n`);
    assert.equal((await once(child, "close"))[0], expected);
    assert.ok(!output.includes(token) && !output.includes(key));
  }
  assert.equal(requests, 2);
});
