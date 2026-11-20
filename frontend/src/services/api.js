export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? "http://localhost:5000/api" : "/api")
).replace(/\/+$/, "");

export function resolveMediaUrl(path) {
  if (!path) return "";
  if (/^(?:https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  const apiOrigin = /^https?:\/\//i.test(API_BASE_URL)
    ? new URL(API_BASE_URL).origin
    : window.location.origin;
  return new URL(path.replace(/^\/+/, ""), `${apiOrigin}/`).href;
}

export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Unable to reach the store service. Check that the backend is running and try again.");
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.message || `Store service request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}
