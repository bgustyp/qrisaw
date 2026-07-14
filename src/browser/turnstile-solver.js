const logger = require("../utils/logger");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.random() * (max - min) + min;

/**
 * Inject an explicit Turnstile widget if the page doesn't already
 * have a solved token (Saweria's own invisible widget sometimes
 * auto-populates the hidden input before this runs).
 */
const injectWidget = async (page, sitekey) => {
  await page.evaluate((key) => {
    const existingInp = document.querySelector('input[name="cf-turnstile-response"]');
    if (existingInp && existingInp.value) return;
    if (document.getElementById("_ts_box")) return;
    window._tsToken = null;
    const wrap = document.createElement("div");
    wrap.id = "_ts_box";
    wrap.style = "position:fixed;top:20px;left:20px;z-index:2147483647;";
    document.body.appendChild(wrap);
    window._tsLoad = function () {
      turnstile.render("#_ts_box", {
        sitekey: key,
        callback: function (t) {
          window._tsToken = t;
        },
      });
    };
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=_tsLoad&render=explicit";
    s.async = true;
    document.head.appendChild(s);
  }, sitekey);
};

const getToken = (page) =>
  page.evaluate(() => {
    if (window._tsToken) return window._tsToken;
    const inp =
      document.querySelector('#_ts_box [name="cf-turnstile-response"]') ||
      document.querySelector('input[name="cf-turnstile-response"]');
    return inp && inp.value ? inp.value : null;
  });

const getIframeRect = (page) =>
  page
    .evaluate(`
      JSON.stringify((() => {
        for (const f of document.querySelectorAll('iframe')) {
          const src = f.src || '';
          if (!src.includes('challenges.cloudflare.com')) continue;
          const r = f.getBoundingClientRect();
          if (r.width > 50 && r.height > 20) return {x:r.x, y:r.y, w:r.width, h:r.height};
        }
        return null;
      })())
    `)
    .then((raw) => (raw && raw !== "null" ? JSON.parse(raw) : null));

/**
 * Wait for an invisible auto-solve, falling back to humanized mouse
 * clicks on the Turnstile checkbox iframe until a token appears or
 * timeoutMs elapses.
 * Returns the token string, or null if unsolved within the timeout.
 */
const solveTurnstile = async (page, { sitekey, timeoutMs }) => {
  await injectWidget(page, sitekey);
  await sleep(5000);

  let token = await getToken(page);
  if (token) {
    logger.info("Turnstile auto-solved (invisible)!");
    return token;
  }

  let rect = null;
  for (let i = 0; i < 20; i++) {
    rect = await getIframeRect(page);
    if (rect) break;
    await sleep(500);
  }

  const deadline = Date.now() + timeoutMs;
  let clickCount = 0;
  let lastClick = 0;

  while (Date.now() < deadline) {
    token = await getToken(page);
    if (token) break;

    const now = Date.now();
    if (clickCount === 0 || (now - lastClick > 8000 && clickCount < 10)) {
      logger.info(`Clicking Turnstile (attempt ${clickCount + 1})...`);
      rect = await getIframeRect(page);
      const cx = rect ? rect.x + 28 + rand(-3, 3) : 48 + rand(-3, 3);
      const cy = rect ? rect.y + rect.h / 2 + rand(-3, 3) : 52 + rand(-3, 3);
      await page.mouse.move(cx - 80, cy - 20);
      await sleep(rand(150, 250));
      await page.mouse.move(cx, cy);
      await sleep(rand(80, 150));
      await page.mouse.click(cx, cy);
      lastClick = Date.now();
      clickCount++;
      await sleep(2000);
      continue;
    }
    await sleep(500);
  }

  return token || null;
};

/** Injects a solved token into the page's hidden Turnstile input. */
const injectToken = async (page, token) => {
  await page.evaluate((t) => {
    const inp = document.querySelector('input[name="cf-turnstile-response"]');
    if (inp) inp.value = t;
  }, token);
};

module.exports = { solveTurnstile, injectToken };
