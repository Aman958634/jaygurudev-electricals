export const BUSINESS_NAME = "JAY GURUDEV ELECTRICALS";

export function normalizeBusinessCopy(value) {
  return String(value ?? "")
    .replace(/GURUDEVV/gi, (match) => {
      if (match === match.toUpperCase()) return "GURUDEV";
      if (match[0] === match[0].toUpperCase()) return "Gurudev";
      return "gurudev";
    })
    .replace(/ELECTRIICALS/gi, (match) => {
      if (match === match.toUpperCase()) return "ELECTRICALS";
      if (match[0] === match[0].toUpperCase()) return "Electricals";
      return "electricals";
    });
}
