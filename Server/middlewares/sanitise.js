// FOLLO SECURITY
import sanitizeHtml from 'sanitize-html';

// Strip ALL HTML — plain text only
const PLAIN_TEXT_OPTIONS = {
  allowedTags:        [],
  allowedAttributes:  {},
  disallowedTagsMode: 'recursiveEscape',
};

/**
 * Recursively sanitise all string values in an object.
 * Strips HTML tags to prevent XSS stored in DB.
 */
export function sanitiseObject(obj) {
  if (typeof obj === 'string') {
    return sanitizeHtml(obj.trim(), PLAIN_TEXT_OPTIONS);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitiseObject);
  }
  if (obj && typeof obj === 'object') {
    const sanitised = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitised[key] = sanitiseObject(value);
    }
    return sanitised;
  }
  return obj; // numbers, booleans, null pass through
}

/**
 * Express middleware — sanitises req.body before
 * it reaches any controller.
 */
export function sanitiseBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitiseObject(req.body);
  }
  next();
}
