const axios = require("axios");
const authService = require("../services/auth.service");
const logger = require("../utils/logger");

const saweria = axios.create({
  baseURL: "https://backend.saweria.co",
  timeout: 15000,
  headers: {
    Origin: "https://saweria.co",
    Referer: "https://saweria.co/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
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
