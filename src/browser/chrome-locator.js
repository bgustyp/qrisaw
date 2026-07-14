const fs = require("fs");
const path = require("path");

/**
 * Locate a Chrome/Edge/Chromium binary on the host OS.
 * Checks CHROME_PATH env var first, then local puppeteer download,
 * then common install locations for Windows, Linux, and macOS.
 */
const findChrome = () => {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates = [
    // Local puppeteer download (npm run setup:chromium)
    path.join(process.cwd(), "chromium", "chrome-linux", "chrome"),
    path.join(process.cwd(), "chromium", "chrome-win64", "chrome.exe"),
    path.join(process.cwd(), "chromium", "chrome-mac-x64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"),
    // Windows
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
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
    if (fs.existsSync(p)) return p;
  }
  return null;
};

module.exports = { findChrome };
