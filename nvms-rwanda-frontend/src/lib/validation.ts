export type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function limitNationalIdInput(value: string) {
  return digitsOnly(value).slice(0, 16);
}

export function limitRwandaPhoneInput(value: string) {
  const compact = value.replace(/[\s().-]/g, "");
  if (compact.startsWith("+")) {
    const digits = digitsOnly(compact).slice(0, 12);
    return digits ? `+${digits}` : "+";
  }
  return digitsOnly(compact).slice(0, 10);
}

export function birthYearFromDate(dateOfBirth?: string | null) {
  if (!dateOfBirth) return null;
  const match = String(dateOfBirth).match(/^(\d{4})/);
  return match ? match[1] : null;
}

export function validateBirthDate(value: string): ValidationResult {
  if (!value.trim()) return { ok: false, error: "Please enter your date of birth." };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Please enter a valid date of birth." };
  if (date > new Date()) return { ok: false, error: "Date of birth cannot be in the future." };
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 18);
  if (date > minDate) return { ok: false, error: "Volunteers must be at least 18 years old to register." };
  return { ok: true, value: value.trim() };
}

export function validateRwandaNationalId(value: string, dateOfBirth?: string | null): ValidationResult {
  const digits = digitsOnly(value);
  if (digits.length !== 16) {
    return { ok: false, error: "National ID must contain exactly 16 digits." };
  }
  if (!digits.startsWith("1")) {
    return { ok: false, error: 'National ID must start with "1".' };
  }
  const year = birthYearFromDate(dateOfBirth);
  if (!year) {
    return { ok: false, error: "Add your date of birth before submitting national ID." };
  }
  if (digits.slice(1, 5) !== year) {
    return { ok: false, error: `National ID must start with 1${year}, matching your year of birth.` };
  }
  return { ok: true, value: digits };
}

export function validateRwandaPhone(value: string): ValidationResult {
  const compact = value.replace(/[\s().-]/g, "");
  if (/^07\d{8}$/.test(compact)) {
    return { ok: true, value: `+25${compact}` };
  }
  if (/^\+2507\d{8}$/.test(compact)) {
    return { ok: true, value: compact };
  }
  return {
    ok: false,
    error: "Phone must be a Rwanda number: 10 local digits like 078XXXXXXX or +2507XXXXXXXX.",
  };
}
