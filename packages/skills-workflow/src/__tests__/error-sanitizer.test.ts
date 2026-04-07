import { describe, it, expect } from 'vitest';
import { sanitizeForSearch } from '../shared/error-sanitizer.js';

describe('error-sanitizer', () => {
  it('redacts absolute paths', () => {
    const result = sanitizeForSearch('Error at /Users/john/project/src/foo.ts:10');
    expect(result.text).toContain('[PATH]');
    expect(result.text).not.toContain('/Users/john');
    expect(result.totalRedacted).toBeGreaterThan(0);
  });

  it('redacts Linux home paths', () => {
    const result = sanitizeForSearch('Error at /home/developer/app/index.js');
    expect(result.text).toContain('[PATH]');
    expect(result.text).not.toContain('/home/developer');
  });

  it('redacts IPv4 addresses', () => {
    const result = sanitizeForSearch('Connection to 192.168.1.100 failed');
    expect(result.text).toBe('Connection to [IP] failed');
  });

  it('redacts email addresses', () => {
    const result = sanitizeForSearch('Contact admin@example.com for help');
    expect(result.text).toBe('Contact [EMAIL] for help');
  });

  it('redacts AWS access keys', () => {
    const result = sanitizeForSearch('aws_key=AKIAIOSFODNN7EXAMPLE');
    expect(result.text).toContain('[API_KEY]');
    expect(result.text).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('redacts GitHub tokens', () => {
    const result = sanitizeForSearch('token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij');
    expect(result.text).toContain('[API_KEY]');
    expect(result.text).not.toContain('ghp_');
  });

  it('redacts JWT tokens', () => {
    const result = sanitizeForSearch(
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    );
    expect(result.text).toContain('[TOKEN]');
  });

  it('tracks redaction counts by type', () => {
    const result = sanitizeForSearch(
      'Error at /Users/a/b.ts and /Users/c/d.ts, contact admin@test.com',
    );
    const pathRedaction = result.redactions.find((r) => r.type === 'path');
    const emailRedaction = result.redactions.find((r) => r.type === 'email');
    expect(pathRedaction?.count).toBe(2);
    expect(emailRedaction?.count).toBe(1);
    expect(result.totalRedacted).toBe(3);
  });

  it('applies extra patterns', () => {
    const result = sanitizeForSearch('Internal server FOO-12345 error', [/FOO-\d+/]);
    expect(result.text).toBe('Internal server [REDACTED] error');
    expect(result.redactions.find((r) => r.type === 'custom')?.count).toBe(1);
  });

  it('returns unchanged text when nothing to redact', () => {
    const result = sanitizeForSearch('TypeError: Cannot read property of undefined');
    expect(result.text).toBe('TypeError: Cannot read property of undefined');
    expect(result.totalRedacted).toBe(0);
  });
});
