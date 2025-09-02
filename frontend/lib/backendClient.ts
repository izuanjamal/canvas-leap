import backend from "~backend/client";
import { useAuthStore } from "../state/authStore";

// Returns a backend client configured with the current auth token (if any).
export function getBackendClient() {
  const token = useAuthStore.getState().token;
  if (!token) return backend;
  return backend.with({
    auth: async () => ({ authorization: `Bearer ${token}` }),
  });
}
