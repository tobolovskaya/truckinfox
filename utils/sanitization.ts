/**
 * Input sanitization utilities
 * Protects against XSS, injection attacks, and malformed data
 */

/**
 * Sanitize message text
 * - Removes HTML/script tags
 * - Limits length
 * - Trims whitespace
 * - Removes control characters
 * 
 * @param message Raw message text
 * @param maxLength Maximum allowed length (default: 1000)
 * @returns Sanitized message
 */
export function sanitizeMessage(message: string, maxLength: number = 1000): string {
  if (!message || typeof message !== 'string') {
    return '';
  }

  // Remove HTML tags (including script tags)
  let sanitized = message.replace(/<[^>]*>/g, '');
  
  // Remove script tags with any attributes
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove on* event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Normalize whitespace (collapse multiple spaces)
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize user name
 * - Removes special characters
 * - Limits length
 * - Removes leading/trailing whitespace
 * 
 * @param name Raw name
 * @param maxLength Maximum allowed length (default: 100)
 * @returns Sanitized name
 */
export function sanitizeName(name: string, maxLength: number = 100): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = name.replace(/<[^>]*>/g, '');
  
  // Remove special characters (allow letters, numbers, spaces, hyphens, apostrophes)
  sanitized = sanitized.replace(/[^a-zA-ZæøåÆØÅ0-9\s\-']/g, '');
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Trim
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize email address
 * - Validates format
 * - Converts to lowercase
 * - Trims whitespace
 * 
 * @param email Raw email
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }

  // Trim and lowercase
  let sanitized = email.trim().toLowerCase();
  
  // Remove any HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Validate email format
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized;
}

/**
 * Sanitize phone number
 * - Removes non-numeric characters (except +)
 * - Validates format
 * 
 * @param phone Raw phone number
 * @returns Sanitized phone number
 */
export function sanitizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Remove all non-numeric characters except +
  let sanitized = phone.replace(/[^0-9+]/g, '');
  
  // Ensure + is only at the start
  if (sanitized.includes('+')) {
    const parts = sanitized.split('+');
    sanitized = '+' + parts.join('');
  }
  
  return sanitized;
}

/**
 * Validate and sanitize URL
 * - Checks for valid URL format
 * - Ensures safe protocol (http/https)
 * - Removes javascript: and data: protocols
 * 
 * @param url Raw URL
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeURL(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // Trim whitespace
  let sanitized = url.trim();
  
  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Check if valid URL
  try {
    const parsed = new URL(sanitized);
    
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Check if URL is valid
 * 
 * @param url URL to validate
 * @returns true if valid URL
 */
export function isValidURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitize generic text input
 * - Removes HTML tags
 * - Limits length
 * - Removes control characters
 * 
 * @param input Raw input
 * @param maxLength Maximum allowed length
 * @returns Sanitized input
 */
export function sanitizeInput(input: string, maxLength: number = 500): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Trim
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize number input
 * - Ensures valid number
 * - Enforces min/max bounds
 * 
 * @param value Raw value
 * @param min Minimum allowed value
 * @param max Maximum allowed value
 * @returns Sanitized number
 */
export function sanitizeNumber(
  value: string | number,
  min: number = Number.MIN_SAFE_INTEGER,
  max: number = Number.MAX_SAFE_INTEGER
): number {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num) || !isFinite(num)) {
    return min;
  }
  
  return Math.max(min, Math.min(max, num));
}

/**
 * Escape HTML special characters
 * Useful for displaying user content safely
 * 
 * @param text Raw text
 * @returns Escaped text
 */
export function escapeHTML(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Strip HTML tags completely
 * 
 * @param html HTML string
 * @returns Plain text
 */
export function stripHTML(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  return html.replace(/<[^>]*>/g, '');
}

/**
 * Validate and sanitize file name
 * - Removes path traversal attempts
 * - Removes special characters
 * - Limits length
 * 
 * @param filename Raw filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  // Remove path traversal
  let sanitized = filename.replace(/\.\./g, '');
  
  // Remove path separators
  sanitized = sanitized.replace(/[\/\\]/g, '');
  
  // Remove special characters (allow letters, numbers, dots, hyphens, underscores)
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Limit length
  const maxLength = 255;
  if (sanitized.length > maxLength) {
    const ext = sanitized.split('.').pop();
    const name = sanitized.substring(0, maxLength - (ext ? ext.length + 1 : 0));
    sanitized = ext ? `${name}.${ext}` : name;
  }
  
  return sanitized;
}

/**
 * Check if string contains only safe characters
 * 
 * @param text Text to check
 * @returns true if safe
 */
export function isSafeString(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return true;
  }

  // Check for common XSS patterns
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<embed/i,
    /<object/i,
  ];

  return !xssPatterns.some(pattern => pattern.test(text));
}

/**
 * Rate limiting for input (prevents spam)
 * Tracks input attempts per user
 */
class InputRateLimiter {
  private attempts: Map<string, { count: number; resetAt: number }> = new Map();

  check(userId: string, maxAttempts: number = 60, windowMs: number = 60000): boolean {
    const now = Date.now();
    const userAttempts = this.attempts.get(userId);

    if (!userAttempts || now > userAttempts.resetAt) {
      this.attempts.set(userId, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (userAttempts.count >= maxAttempts) {
      return false;
    }

    userAttempts.count++;
    return true;
  }

  reset(userId: string): void {
    this.attempts.delete(userId);
  }
}

export const inputRateLimiter = new InputRateLimiter();
