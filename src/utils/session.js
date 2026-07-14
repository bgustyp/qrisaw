const fs = require("fs");
const path = require("path");
const writeFileAtomic = require("write-file-atomic");
const logger = require("./logger");

const SESSION_FILE = path.join(__dirname, "../../session.json");

/**
 * Decode JWT payload without external library.
 * Returns null if token is malformed.
 */
const decodeJwtPayload = (token) => {
  try {
    if (!token || typeof token !== "string") return null;
    
    // JWT format: header.payload.signature
    // Strip "Bearer " prefix if present
    const raw = token.startsWith("Bearer ") ? token.slice(7) : token;
    const parts = raw.split(".");
    if (parts.length !== 3) return null;

    // Validate base64 format before decoding
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    
    // Validate JSON structure
    const parsed = JSON.parse(decoded);
    if (typeof parsed !== "object" || parsed === null) return null;
    
    return parsed;
  } catch (err) {
    logger.debug("Failed to decode JWT", { error: err.message });
    return null;
  }
};

/**
 * Check if a JWT token is still valid (not expired).
 * Uses a 5-minute margin to avoid edge-case failures.
 */
const isTokenValid = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return false;

  const now = Math.floor(Date.now() / 1000);
  const margin = 5 * 60; // 5 minutes
  return payload.exp > now + margin;
};

const saveSession = (data) => {
  try {
    const content = JSON.stringify(data, null, 2);
    writeFileAtomic.sync(SESSION_FILE, content, { mode: 0o600 });
    logger.info("Session saved to session.json");
  } catch (err) {
    logger.error("Failed to save session", { error: err.message });
  }
};

const loadSession = () => {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const raw = fs.readFileSync(SESSION_FILE, "utf8");
      
      // Validate JSON structure
      if (!raw || raw.trim().length === 0) {
        logger.warn("Session file is empty");
        return null;
      }
      
      const data = JSON.parse(raw);
      
      // Validate required fields
      if (!data || typeof data !== "object" || !data.authToken || !data.userId) {
        logger.warn("Session file missing required fields");
        return null;
      }

      // Validate token expiry before returning
      if (!isTokenValid(data.authToken)) {
        logger.warn("Session token has expired. Discarding saved session.");
        clearSession();
        return null;
      }

      return data;
    }
  } catch (err) {
    logger.error("Failed to load session", { error: err.message });
    // If corrupt, clear it
    clearSession();
  }
  return null;
};

const clearSession = () => {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
      logger.info("Session file cleared");
    }
  } catch (err) {
    logger.error("Failed to clear session", { error: err.message });
  }
};

const getTokenTimeRemaining = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return null;
  const expiryTime = payload.exp * 1000;
  return expiryTime - Date.now();
};

module.exports = {
  saveSession,
  loadSession,
  clearSession,
  isTokenValid,
  getTokenTimeRemaining,
};
