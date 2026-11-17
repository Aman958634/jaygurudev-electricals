import { apiRequest } from "../services/api.js";

export async function adminRequest(token, path, options = {}) {
  try {
    return await apiRequest(path, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error) {
    if (error.status === 401 && token) {
      window.dispatchEvent(new Event("admin:session-expired"));
    }
    throw error;
  }
}
