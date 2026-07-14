const { connect } = require("puppeteer-real-browser");
const fs = require("fs");
const os = require("os");
const path = require("path");
const logger = require("../utils/logger");
const { findChrome } = require("../browser/chrome-locator");
const { solveTurnstile, injectToken } = require("../browser/turnstile-solver");

const SITEKEY = "0x4AAAAAABdD0SArXy9tgW81";
const LOGIN_URL = "https://saweria.co/login";
const TIMEOUT_MS = 60000;
// Opt-in headless for headless servers. Default headful (Turnstile solves more reliably with a GUI).
const HEADLESS = process.env.BROWSER_HEADLESS === "true";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.random() * (max - min) + min;

const makeTempDir = () => {
  const dir = path.join(os.tmpdir(), `saweria_ts_${process.pid}_${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const removeDir = (dir) => {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
};

/**
 * Login to Saweria via real Chrome (puppeteer-real-browser).
 * Injects Turnstile widget, intercepts fetch response, fills form, submits.
 * Returns { authToken, userId }.
 */
const browserLogin = async (retries = 3) => {
  const email = process.env.SAWERIA_EMAIL;
  const password = process.env.SAWERIA_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing SAWERIA_EMAIL or SAWERIA_PASSWORD");
  }

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    logger.info(`Browser login attempt ${attempt}/${retries}...`);
    const profileDir = makeTempDir();
    let browser;

    try {
      const chromePath = findChrome();
      if (!chromePath) throw new Error("Chrome/Edge not found. Set CHROME_PATH env var.");
      logger.info(`Using browser: ${chromePath}`);

      const { browser: br, page } = await connect({
        headless: HEADLESS,
        args: [],
        customConfig: {
          userDataDir: profileDir,
          chromePath: chromePath,
        },
        turnstile: true,
        connectOption: { defaultViewport: null },
        disableXvfb: process.platform === "win32",
        ignoreAllFlags: false,
      });
      browser = br;

      // Use CDP Network interception to capture /auth/login response
      const cdpClient = await page.createCDPSession();
      await cdpClient.send('Network.enable');
      let cdpAuthToken = null;
      let cdpUserId = null;

      cdpClient.on('Network.responseReceived', async (evt) => {
        try {
          if (evt.response.url.includes('/auth/login')) {
            cdpAuthToken = evt.response.headers['authorization'] || evt.response.headers['Authorization'] || null;
            const bodyResp = await cdpClient.send('Network.getResponseBody', { requestId: evt.requestId }).catch(() => null);
            if (bodyResp) {
              const parsed = JSON.parse(bodyResp.body);
              cdpUserId = (parsed.data && parsed.data.id) ? parsed.data.id : null;
            }
          }
        } catch (_) {}
      });

      logger.info("Opening Saweria login page...");
      await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
      await sleep(rand(2500, 3500));

      const tsToken = await solveTurnstile(page, { sitekey: SITEKEY, timeoutMs: TIMEOUT_MS });
      if (!tsToken) throw new Error(`Turnstile token not obtained within ${TIMEOUT_MS}ms`);
      logger.info(`Token obtained (${tsToken.length} chars), injecting into form...`);
      await injectToken(page, tsToken);

      // Fill credentials via JS value injection (avoids @ drop on non-US keyboard layouts)
      const fillInput = async (selector, value) => {
        await page.evaluate(({ sel, val }) => {
          const el = document.querySelector(sel);
          if (!el) return;
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, { sel: selector, val: value });
      };

      await fillInput('[data-testid="email-form"]', email);
      await sleep(300);
      await fillInput('[data-testid="password-form"]', password);

      await sleep(500);

      // Enable + click submit
      await page.evaluate(`
        (() => {
          const btn = document.querySelector('[data-testid="submit-login"]');
          if (btn) { btn.disabled = false; btn.removeAttribute('disabled'); }
        })();
      `);
      await page.click('[data-testid="submit-login"]');

      logger.info("Form submitted, waiting for login response...");

      // Poll CDP-captured auth data
      const deadline2 = Date.now() + 30000;
      while (Date.now() < deadline2) {
        if (cdpAuthToken && cdpUserId) break;
        await sleep(500);
      }

      if (!cdpAuthToken || !cdpUserId) {
        logger.warn(`CDP captured: authToken=${cdpAuthToken}, userId=${cdpUserId}`);
        throw new Error("Login response not captured — CDP Network listener missed /auth/login");
      }

      logger.info(`Browser login successful! User ID: ${cdpUserId}`);
      return { authToken: cdpAuthToken, userId: cdpUserId };

    } catch (err) {
      lastError = err;
      logger.warn(`Browser login attempt ${attempt} failed`, { error: err.message });
      if (attempt < retries) {
        const backoffMs = Math.min(2000 * attempt, 10000);
        logger.info(`Retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
      }
    } finally {
      if (browser) {
        try { await browser.close(); } catch (_) {}
      }
      removeDir(profileDir);
    }
  }

  throw new Error(`Browser login failed after ${retries} attempts: ${lastError.message}`);
};

module.exports = { browserLogin };
