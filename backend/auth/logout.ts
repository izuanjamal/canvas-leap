import { api, Cookie } from "encore.dev/api";

interface LogoutResponse {
  session: Cookie<"session">;
}

// Logs out the user by clearing the session cookie.
export const logout = api<void, LogoutResponse>(
  { expose: true, method: "POST", path: "/auth/logout" },
  async () => {
    const expired: Cookie<"session"> = {
      value: "",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      expires: new Date(0),
    };
    return { session: expired };
  }
);
