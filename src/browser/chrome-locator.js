const fs = require("fs");
const path = require("path");

/**
 * Locate a Chrome/Edge/Chromium binary on the host OS.
 * Checks CHROME_PATH first, then system install locations.
 */
const findChrome = () => {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates = [
    // Windows
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.platform === "win32" && process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe"),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    // Linux
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/microsoft-edge-stable",
    "/usr/bin/microsoft-edge",
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];
  for (const p of candidates) {
    if (p && path.isAbsolute(p) && fs.existsSync(p)) return p;
  }
  return null;
};

module.exports = { findChrome };
