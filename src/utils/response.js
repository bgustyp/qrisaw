/**
 * Extract meaningful error info from various error types.
 * - Axios errors: forward the upstream status code & message
 * - Generic errors: return 500 with safe message
 */
const extractErrorInfo = (err) => {
  // Axios error with response from Saweria
  if (err.response) {
    const status = err.response.status;
    const upstream =
      err.response.data?.message || err.response.data?.error || err.message;
    return { status, message: upstream };
  }

  // Axios network/timeout error (no response received)
  if (err.code === "ECONNABORTED" || err.code === "ERR_NETWORK") {
    return { status: 502, message: "Upstream service unavailable" };
  }

  // Application-level validation errors (thrown manually)
  if (err.statusCode) {
    return { status: err.statusCode, message: err.message };
  }

  // Fallback
  return { status: 500, message: err.message || "Internal server error" };
};

const success = (res, message, data = null, code = 200) => {
  res.status(code).json({
    success: true,
    message,
    data,
  });
};

const error = (res, err) => {
  // Support both Error objects and plain strings
  if (typeof err === "string") {
    return res.status(500).json({ success: false, message: err });
  }

  const { status, message } = extractErrorInfo(err);
  res.status(status).json({
    success: false,
    message,
  });
};

module.exports = { success, error };
