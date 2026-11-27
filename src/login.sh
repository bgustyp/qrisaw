#!/usr/bin/env bash
set +x
set -eu -o pipefail

printf '%s\n' 'Login di https://saweria.co/login melalui browser. Gunakan sesi akun milik Anda.' >&2
read -r -p 'Saweria user ID: ' user_id
read -rs -p 'Token sesi (input tersembunyi): ' token
printf '\n' >&2

# Pass the token through stdin, not command arguments or environment variables.
printf '%s\n%s\n' "$user_id" "$token" | node -r dotenv/config -e '
  const http = require("node:http");
  const [userId, authToken] = require("node:fs").readFileSync(0, "utf8").split("\n");
  const key = process.env.ADMIN_KEY;
  if (!key || !userId || !authToken) {
    console.error("ADMIN_KEY, user ID dan token sesi wajib diisi.");
    process.exit(1);
  }
  const req = http.request({
    hostname: "127.0.0.1", port: Number(process.env.PORT || 3000),
    path: "/health/session", method: "POST", agent: false,
    headers: { "X-Admin-Key": key, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(5000),
  }, res => {
    res.resume();
    if (res.statusCode === 200) console.log("Wrapper menerima sesi. Cek data.auth di /health.");
    else {
      console.error(`Wrapper menolak sesi (HTTP ${res.statusCode}).`);
      process.exitCode = 1;
    }
  });
  req.on("error", () => {
    console.error("Wrapper lokal tidak dapat dihubungi. Periksa server dan PORT.");
    process.exitCode = 1;
  });
  req.end(JSON.stringify({ userId, authToken }));
'
