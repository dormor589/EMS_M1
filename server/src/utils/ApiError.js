/**
 * ApiError — an Error that carries an HTTP status code.
 *
 * Services and controllers throw these; the central error handler turns them
 * into JSON responses. Anything thrown that is NOT an ApiError is treated as an
 * unexpected fault and reported as a generic 500, so internal details (SQL text,
 * stack traces, driver messages) can never leak to a client.
 */
class ApiError extends Error {
  /**
   * @param {number}  status    HTTP status code.
   * @param {string}  message   Client-safe message.
   * @param {object} [details]  Optional structured detail, e.g. field errors.
   */
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message, details)   { return new ApiError(400, message, details); }
  static unauthorized(message = 'Authentication required') { return new ApiError(401, message); }
  static forbidden(message = 'You do not have permission to do that') { return new ApiError(403, message); }
  static notFound(message = 'Not found') { return new ApiError(404, message); }
  static conflict(message, details)     { return new ApiError(409, message, details); }
  static unprocessable(message, details){ return new ApiError(422, message, details); }
  static internal(message = 'Internal server error') { return new ApiError(500, message); }
}

export default ApiError;
