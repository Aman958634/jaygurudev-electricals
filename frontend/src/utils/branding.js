export const BUSINESS_NAME = "JAY GURUDEV ELECTRIICALS";

export function normalizeBusinessCopy(value) {
  return String(value ?? "")
    .replace(/\bJAY\s+GURU\s*DEV[V]?\s+ELECTRI?ICALS\b/gi, BUSINESS_NAME)
    .replace(/\bGURUDEV[V]?\b/gi, (match) => preserveCase(match, "GURUDEV"))
    .replace(/\bELECTRI?ICALS\b/gi, (match) => preserveCase(match, "ELECTRIICALS"));
}

function preserveCase(value, replacement) {
  if (value === value.toUpperCase()) return replacement;
  if (value[0] === value[0].toUpperCase()) {
    return replacement[0] + replacement.slice(1).toLowerCase();
  }
  return replacement.toLowerCase();
}
