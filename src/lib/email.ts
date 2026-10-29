/**
 * Emails are case-insensitive in practice, and phones often capitalise the first letter or add
 * a trailing space. Sign-in, registration and password reset send the address trimmed and in
 * lower case, so "Owner@Example.com " matches an account stored as "owner@example.com".
 * Passwords are never altered.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
