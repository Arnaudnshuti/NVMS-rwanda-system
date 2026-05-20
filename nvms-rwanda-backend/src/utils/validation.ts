export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function birthYearFromDate(value?: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return String(value.getUTCFullYear()).padStart(4, "0");
  }
  const match = String(value).match(/^(\d{4})/);
  return match ? match[1] : null;
}

export function validateBirthDate(value?: string) {
  if (!value?.trim()) return { ok: false as const, error: "Date of birth is required." };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { ok: false as const, error: "Date of birth is invalid." };
  if (date > new Date()) return { ok: false as const, error: "Date of birth cannot be in the future." };
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 18);
  if (date > minDate) return { ok: false as const, error: "Volunteers must be at least 18 years old to register." };
  return { ok: true as const, value: date };
}

export function validateRwandaNationalId(value: string, dateOfBirth?: Date | string | null) {
  const digits = digitsOnly(value);
  if (digits.length !== 16) {
    return { ok: false as const, error: "National ID must contain exactly 16 digits." };
  }
  if (!digits.startsWith("1")) {
    return { ok: false as const, error: 'National ID must start with "1".' };
  }
  const year = birthYearFromDate(dateOfBirth);
  if (!year) {
    return { ok: false as const, error: "Date of birth is required before validating national ID." };
  }
  if (digits.slice(1, 5) !== year) {
    return { ok: false as const, error: `National ID must start with 1${year}, matching year of birth.` };
  }
  return { ok: true as const, value: digits };
}

export function validateRwandaPhone(value: string) {
  const compact = value.replace(/[\s().-]/g, "");
  if (/^07\d{8}$/.test(compact)) {
    return { ok: true as const, value: `+25${compact}` };
  }
  if (/^\+2507\d{8}$/.test(compact)) {
    return { ok: true as const, value: compact };
  }
  return {
    ok: false as const,
    error: "Phone must be a Rwanda number: 10 local digits like 078XXXXXXX or +2507XXXXXXXX.",
  };
}
