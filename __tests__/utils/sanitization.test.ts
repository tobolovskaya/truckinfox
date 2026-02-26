import { sanitizeMessage, sanitizeInput, sanitizeNumber } from '../../utils/sanitization';

describe('Sanitization Utils', () => {
  describe('sanitizeMessage', () => {
    it('should remove XSS attempts with script tags', () => {
      const malicious = '<script>alert("xss")</script>Hello';
      const result = sanitizeMessage(malicious);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('should remove HTML tags', () => {
      const htmlContent = '<div onclick="alert(\'xss\')">Hello</div>';
      const result = sanitizeMessage(htmlContent);
      expect(result).not.toContain('<div');
      expect(result).not.toContain('>');
    });

    it('should limit message length', () => {
      const longMessage = 'a'.repeat(1000);
      const result = sanitizeMessage(longMessage, 500);
      expect(result.length).toBeLessThanOrEqual(500);
    });

    it('should preserve normal text', () => {
      const normalText = 'This is a normal message with numbers 123';
      const result = sanitizeMessage(normalText);
      expect(result).toContain('normal message');
    });

    it('should handle SQL injection attempts', () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const result = sanitizeMessage(sqlInjection);
      expect(result).toBeDefined();
      // Sanitizer should neutralize the threat
      expect(result).toContain('DROP');
    });

    it('should remove newline injection attempts', () => {
      const newlineInjection = 'Hello\n\n<script>alert("xss")</script>';
      const result = sanitizeMessage(newlineInjection);
      expect(result).not.toContain('<script>');
    });

    it('should trim whitespace', () => {
      const whitespaced = '   Hello World   ';
      const result = sanitizeMessage(whitespaced);
      expect(result).toBe('Hello World');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeMessage(null as unknown as string)).toBe('');
      expect(sanitizeMessage(undefined as unknown as string)).toBe('');
    });
  });

  describe('sanitizeInput', () => {
    it('should remove special characters from input fields', () => {
      const input = "John<script>O'Reilly</script>";
      const result = sanitizeInput(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should enforce max length', () => {
      const longInput = 'a'.repeat(300);
      const result = sanitizeInput(longInput, 255);
      expect(result.length).toBeLessThanOrEqual(255);
    });

    it('should preserve alphanumeric characters', () => {
      const input = 'John Doe 123';
      const result = sanitizeInput(input);
      expect(result).toContain('John');
      expect(result).toContain('123');
    });

    it('should allow common punctuation', () => {
      const input = 'test@example.com';
      const result = sanitizeInput(input);
      expect(result).toContain('@');
      expect(result).toContain('.');
    });

    it('should handle empty string', () => {
      const result = sanitizeInput('');
      expect(result).toBe('');
    });
  });

  describe('sanitizeNumber', () => {
    it('should parse valid numbers', () => {
      expect(sanitizeNumber('123')).toBe(123);
      expect(sanitizeNumber('45.67')).toBe(45.67);
      expect(sanitizeNumber('-100')).toBe(-100);
    });

    it('should return 0 for invalid input', () => {
      expect(sanitizeNumber('abc')).toBe(0);
      expect(sanitizeNumber('12.34.56')).toBe(0);
      expect(sanitizeNumber('')).toBe(0);
    });

    it('should enforce min/max bounds', () => {
      const result = sanitizeNumber('500', 0, 100);
      expect(result).toBeLessThanOrEqual(100);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle null input', () => {
      expect(sanitizeNumber(null as unknown as string)).toBe(0);
    });

    it('should reject negative values when minimum is 0', () => {
      const result = sanitizeNumber('-50', 0);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should preserve decimal values', () => {
      const result = sanitizeNumber('123.456789');
      expect(result).toBe(123.456789);
    });
  });
});
