require("dotenv").config({ quiet: true });
const http = require("node:http");
const readline = require("node:readline");

async function main() {
  console.error("Login di https://saweria.co/login melalui browser. Gunakan sesi akun milik Anda.");
  // Terminal mode without an output stream prevents echoing credentials.
  const input = readline.createInterface({ input: process.stdin, terminal: !!process.stdin.isTTY, crlfDelay: Infinity });
  const lines = input[Symbol.asyncIterator]();
  let userId, authToken;
  try {
    process.stderr.write("Saweria user ID (input tersembunyi): ");
    userId = (await lines.next()).value;
    process.stderr.write("\nToken sesi (input tersembunyi): ");
    authToken = (await lines.next()).value;
  } finally {
    input.close();
    process.stderr.write("\n");
  }
  const key = process.env.ADMIN_KEY;
  if (!key || !userId || !authToken) {
    console.error("ADMIN_KEY, user ID dan token sesi wajib diisi.");
    process.exitCode = 1;
    return;
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
}

main().catch(() => {
  console.error("Gagal membaca input atau mengirim sesi ke wrapper lokal.");
  process.exitCode = 1;
});
