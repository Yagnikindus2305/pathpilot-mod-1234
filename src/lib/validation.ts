import { COUNTRY_DIAL_CODES, DEFAULT_COUNTRY_ISO2 } from './countries';

// Catches placeholder numbers people type to get past validation without
// giving a real one — all-same-digit (9999999999) and sequential runs
// (1234567890, 9876543210). This can't prove the number is reachable (that
// needs real SMS OTP verification), it just filters out obvious junk.
const ASCENDING_DIGIT_CYCLE = '0123456789012345678901234567890123456789';
const DESCENDING_DIGIT_CYCLE = '9876543210987654321098765432109876543210';

function looksFake(digits: string): boolean {
  if (!digits) return false;
  if (/^(\d)\1+$/.test(digits)) return true;
  return ASCENDING_DIGIT_CYCLE.includes(digits) || DESCENDING_DIGIT_CYCLE.includes(digits);
}

// Strips everything but digits and caps at 14 (longest real national number,
// excluding the country code) — used by <PhoneInput>'s onChange so it's
// physically impossible to type more digits than any real number needs.
export function sanitizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 14);
}

export interface ParsedPhone {
  iso2: string;
  digits: string;
}

// Phone values are always written as "+<dialcode> <digits>" (see
// formatPhoneValue) so round-tripping through this app is unambiguous. A bare
// digit string — the format used before country selection existed — is
// treated as an Indian number, matching this app's original behavior.
export function parsePhoneValue(value: string): ParsedPhone {
  const trimmed = (value || '').trim();
  if (!trimmed) return { iso2: DEFAULT_COUNTRY_ISO2, digits: '' };
  if (trimmed.startsWith('+')) {
    const spaceIdx = trimmed.indexOf(' ');
    const dialPart = spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx);
    const rest = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1);
    const country = COUNTRY_DIAL_CODES.find((c) => c.dialCode === dialPart);
    return { iso2: country?.iso2 || DEFAULT_COUNTRY_ISO2, digits: sanitizePhoneDigits(rest) };
  }
  return { iso2: DEFAULT_COUNTRY_ISO2, digits: sanitizePhoneDigits(trimmed) };
}

export function formatPhoneValue(iso2: string, digits: string): string {
  if (!digits) return '';
  const country = COUNTRY_DIAL_CODES.find((c) => c.iso2 === iso2) || COUNTRY_DIAL_CODES[0];
  return `+${country.dialCode} ${digits}`;
}

// India keeps the original strict rule (exactly 10 digits, starting 6-9) —
// for every other country there's no single universal length, so this
// accepts the common real-world range instead of hand-encoding a rule per
// dial code.
export function isValidPhone(value: string): boolean {
  const { iso2, digits } = parsePhoneValue(value);
  if (looksFake(digits)) return false;
  if (iso2 === 'IN') return /^[6-9]\d{9}$/.test(digits);
  return digits.length >= 7 && digits.length <= 14;
}

export const PHONE_HELP_TEXT = 'India: exactly 10 digits starting with 6-9. Other countries: 7-14 digits. Not a placeholder like 9999999999.';

// Stricter than the browser's native type="email" check (which happily accepts
// things like "a@b" with no real TLD) — this is a format check only, not a
// deliverability check (proving an inbox is real needs an actual verification
// email, which Supabase's signup confirmation already handles). It exists to
// stop obviously-malformed input, including a fake single-letter TLD, from
// triggering an actual signup/OTP email send before Supabase even gets asked.
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export function isValidEmail(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

export const EMAIL_HELP_TEXT = 'Enter a valid email address (e.g. name@example.com).';

// Small set of the most commonly leaked/guessed passwords — not exhaustive,
// just enough to reject the obvious ones a strength score alone wouldn't catch
// (e.g. "Password1!" scores well on variety but is a top-10 breached password).
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password1!', 'passw0rd', '12345678', '123456789',
  'qwerty123', 'letmein1', 'welcome1', 'iloveyou1', 'admin1234', 'football1',
  'monkey123', 'dragon123', 'trustno1', 'abcd1234', 'qwertyuiop',
]);

export interface PasswordStrength {
  score: number; // 0-5
  label: 'Very weak' | 'Weak' | 'Fair' | 'Strong' | 'Very strong';
  issues: string[];
}

export function checkPasswordStrength(pw: string): PasswordStrength {
  const checks: [boolean, string][] = [
    [pw.length >= 8, 'At least 8 characters'],
    [/[a-z]/.test(pw), 'A lowercase letter'],
    [/[A-Z]/.test(pw), 'An uppercase letter'],
    [/[0-9]/.test(pw), 'A number'],
    [/[^a-zA-Z0-9]/.test(pw), 'A special character (e.g. ! @ # $)'],
  ];
  const issues = checks.filter(([ok]) => !ok).map(([, label]) => label);
  const isCommon = pw.length > 0 && COMMON_PASSWORDS.has(pw.toLowerCase());
  if (isCommon) issues.unshift('Not a commonly guessed password');

  const score = isCommon ? 0 : checks.filter(([ok]) => ok).length;
  const labels: PasswordStrength['label'][] = ['Very weak', 'Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  return { score, label: labels[score], issues };
}

export function isStrongPassword(pw: string): boolean {
  return checkPasswordStrength(pw).score === 5;
}

export const PASSWORD_HELP_TEXT = 'At least 8 characters, with uppercase, lowercase, a number, and a special character.';
