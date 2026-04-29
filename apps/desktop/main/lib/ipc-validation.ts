/** Validate that a value is a non-empty string. */
export function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

/** Validate that a value is a positive integer. */
export function requirePositiveInt(value: unknown, name: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value as number;
}

/** Validate that a value is a non-negative integer. */
export function requireNonNegativeInt(value: unknown, name: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value as number;
}

/**
 * Validate that keys and values are paired arrays of the correct types.
 * Keys must be non-empty strings, values must be positive integers (roster IDs).
 */
export function requirePairedArrays(
  keys: unknown,
  values: unknown,
  keyName: string,
  valueName: string,
): void {
  if (!Array.isArray(keys) || !Array.isArray(values)) {
    throw new Error(`${keyName} and ${valueName} must be arrays`);
  }
  if (keys.length !== values.length) {
    throw new Error(`${keyName} and ${valueName} must have the same length`);
  }
  for (const k of keys) {
    if (typeof k !== "string" || !k.trim()) {
      throw new Error(`${keyName} contains an empty value`);
    }
  }
  for (const v of values) {
    if (!Number.isInteger(v) || (v as number) <= 0) {
      throw new Error(`${valueName} contains an invalid roster id`);
    }
  }
}

/**
 * Validate that keys and values are paired arrays (string keys, any values).
 * Allows empty arrays. Used for optional paired fields like draft_picks.
 */
export function requirePairedStringArrays(
  keys: unknown,
  values: unknown,
  keyName: string,
  valueName: string,
): void {
  if (!Array.isArray(keys) || !Array.isArray(values)) {
    throw new Error(`${keyName} and ${valueName} must be arrays`);
  }
  if (keys.length !== values.length) {
    throw new Error(`${keyName} and ${valueName} must have the same length`);
  }
}

/** Validate a date string is YYYY-MM-DD format. */
export function requireDateString(value: unknown, name: string): string {
  const s = requireString(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`${name} must be in YYYY-MM-DD format`);
  }
  return s;
}

/** Validate an array of non-empty strings. */
export function requireStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(`${name} contains an empty value`);
    }
  }
  return value as string[];
}
