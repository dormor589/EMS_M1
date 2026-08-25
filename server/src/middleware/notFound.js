/**
 * notFound — terminal handler for a path no route matched.
 *
 * Returns JSON rather than Express's default HTML, so a client parsing every
 * response as JSON does not choke on a mistyped URL.
 */

import ApiError from '../utils/ApiError.js';

export default function notFound(req, _res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}
