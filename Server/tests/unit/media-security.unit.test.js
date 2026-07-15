// FOLLO READINESS — DB-free unit tests for the media upload security guard.
// Verifies the dangerous-MIME denylist that blocks stored-XSS via the CDN origin.
import { describe, it, expect } from '@jest/globals';
import { isDangerousMimeType } from '../../lib/r2.js';

describe('isDangerousMimeType — blocks active/script-capable uploads', () => {
  it('rejects HTML/SVG/XML/JS/script MIME types (case-insensitive)', () => {
    for (const mime of [
      'text/html',
      'image/svg+xml',
      'application/xhtml+xml',
      'application/xml',
      'text/xml',
      'application/javascript',
      'text/javascript',
      'application/x-httpd-php',
      'application/x-sh',
      'TEXT/HTML',
      'Image/SVG+XML',
    ]) {
      expect(isDangerousMimeType(mime)).toBe(true);
    }
  });

  it('allows ordinary media/document MIME types', () => {
    for (const mime of [
      'image/png',
      'image/jpeg',
      'image/webp',
      'video/mp4',
      'audio/mpeg',
      'application/pdf',
      'application/zip',
    ]) {
      expect(isDangerousMimeType(mime)).toBe(false);
    }
  });

  it('handles missing/garbage input safely', () => {
    expect(isDangerousMimeType(undefined)).toBe(false);
    expect(isDangerousMimeType(null)).toBe(false);
    expect(isDangerousMimeType('')).toBe(false);
  });
});
