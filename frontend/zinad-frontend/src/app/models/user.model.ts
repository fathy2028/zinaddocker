export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  status: string;
  message: string;
  data?: {
    user: User;
    token: string;
    token_type: string;
    expires_in: number;
  };
  errors?: any;
}

export interface RegisterResponse {
  status: string;
  message: string;
  data?: User;
  errors?: any;
}

export interface ApiResponse<T = any> {
  status: string;
  message: string;
  data?: T;
  errors?: any;
}
