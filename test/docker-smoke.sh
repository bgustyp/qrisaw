#!/bin/sh
set -eu

# Build from the release inputs, never from the developer's credentials or session.
fixture=$(mktemp -d)
project="qrisaw-smoke-$(basename "$fixture" | tr '[:upper:].' '[:lower:]-')"
compose() { docker compose --project-directory "$fixture" -p "$project" -f "$fixture/docker-compose.yml" "$@"; }
cleanup() {
  if [ -n "${container:-}" ]; then docker stop "$container" >/dev/null; fi
  compose down >/dev/null
  rm -r "$fixture"
}
cp -R app.js package.json package-lock.json src docs Dockerfile .dockerignore docker-compose.yml "$fixture/"
sed '/^SAWERIA_EMAIL=/d; /^SAWERIA_PASSWORD=/d' .env.example > "$fixture/.env"
trap cleanup EXIT
compose build qrisaw
container=$(compose run --no-deps --rm -d qrisaw)
docker exec "$container" node -e '
  const assert = require("node:assert/strict");
  (async () => {
    assert.equal(process.env.NODE_ENV, "production");
    assert.notEqual(process.getuid(), 0);
    const session = require("./src/utils/session");
    session.saveSession({ authToken: "smoke", userId: "fixture" });
    assert.equal(require("node:fs").statSync(process.env.SESSION_FILE).mode & 0o777, 0o600);
    for (let i = 0; i < 30; i++) {
      const res = await fetch("http://127.0.0.1:3000/health").catch(() => null);
      if (res?.ok && (await res.json()).data.status === "ok") return;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw Error("Container health check failed");
  })();'
