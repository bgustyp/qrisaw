const axios = require("axios");
const initCycleTLS = require("cycletls");
const authService = require("../services/auth.service");
const logger = require("../utils/logger");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36";
// shortcut: static Chrome fingerprints, refresh when Cloudflare starts rejecting them
const CHROME_JA3 =
  "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513,29-23-24,0";
const CHROME_HTTP2 = "1:65536,2:0,3:1000,4:6291456,6:262144|15663105|0|m,a,s,p";

let cycleTLSPromise;
const getCycleTLS = () => {
  if (!cycleTLSPromise) {
    cycleTLSPromise = initCycleTLS();
    const cleanup = async () => {
      try {
        (await cycleTLSPromise).exit();
      } catch {
        // process is exiting anyway
      }
    };
    process.once("SIGINT", async () => {
      await cleanup();
      process.exit(130);
    });
    process.once("SIGTERM", async () => {
      await cleanup();
      process.exit(143);
    });
  }
  return cycleTLSPromise;
};

// axios adapter over CycleTLS: requests keep Chrome's TLS/HTTP2 fingerprints,
// because Cloudflare blocks plain-Node TLS clients from datacenter IPs.
const cycleTLSAdapter = async (config) => {
  const cycleTLS = await getCycleTLS();
  const headers =
    config.headers && typeof config.headers.toJSON === "function"
      ? config.headers.toJSON()
      : { ...config.headers };

  let resp;
  try {
    resp = await cycleTLS(
      axios.getUri(config),
      {
        headers,
        body:
          typeof config.data === "string"
            ? config.data
            : config.data
              ? JSON.stringify(config.data)
              : "",
        ja3: CHROME_JA3,
        http2Fingerprint: CHROME_HTTP2,
        userAgent: USER_AGENT,
        timeout: Math.ceil((config.timeout || 15000) / 1000),
      },
      config.method,
    );
  } catch (err) {
    const error = new Error(err.message || "CycleTLS transport error");
    error.config = config;
    throw error;
  }

  const response = {
    data: resp.data,
    status: resp.status,
    statusText: "",
    headers: resp.headers || {},
    config,
  };
  const validate = config.validateStatus || ((s) => s >= 200 && s < 300);
  if (!validate(resp.status)) {
    const error = new Error(`Request failed with status code ${resp.status}`);
    error.config = config;
    error.response = response;
    throw error;
  }
  return response;
};

const saweria = axios.create({
  baseURL: "https://backend.saweria.co",
  timeout: 15000,
  adapter: cycleTLSAdapter,
  headers: {
    Origin: "https://saweria.co",
    Referer: "https://saweria.co/",
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  },
});

// --- Request interceptor: attach token ---
saweria.interceptors.request.use(
  async (config) => {
    const token = authService.getToken();
    if (token) {
      config.headers.Authorization = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// --- Response interceptor: auto re-login on 401, with mutex ---
let isRefreshing = false;
let refreshQueue = []; // { resolve, reject }

const processQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  refreshQueue = [];
};

saweria.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only handle 401, and only retry once per request
    if (
      !error.response ||
      error.response.status !== 401 ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // If a refresh is already in progress, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers = { ...originalRequest.headers, Authorization: token };
        return saweria(originalRequest);
      }).catch((err) => Promise.reject(err));
    }

    // Start refresh
    isRefreshing = true;

    try {
      logger.warn("Token expired (401). Attempting to re-login...");
      const { authToken } = await authService.login();

      if (authToken) {
        logger.info("Re-login successful, processing queued requests");
        processQueue(null, authToken);
        originalRequest.headers.Authorization = authToken;
        return saweria(originalRequest);
      }

      const err = new Error("Re-login succeeded but no token returned");
      logger.error("Re-login failed", { error: err.message });
      processQueue(err);
      return Promise.reject(err);
    } catch (loginError) {
      logger.error("Re-login failed, rejecting all queued requests", {
        error: loginError.message,
        queueSize: refreshQueue.length,
      });
      processQueue(loginError);
      return Promise.reject(loginError);
    } finally {
      isRefreshing = false;
    }
  },
);

module.exports = saweria;
