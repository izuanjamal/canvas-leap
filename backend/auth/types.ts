export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  created_at: Date;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
}

export interface UpdateMeRequest {
  display_name?: string;
  avatar_url?: string;
}

export interface GoogleExchangeRequest {
  code: string;
  code_verifier: string;
  redirect_uri: string;
}

export interface GoogleExchangeResponse {
  token: string;
  user: AuthUser;
}
