import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { User, LoginRequest, RegisterRequest, AuthResponse, RegisterResponse, ApiResponse } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:8000/api'; // Docker backend URL
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Check if user is already logged in on service initialization
    this.checkAuthStatus();
  }

  /**
   * Check authentication status on app initialization
   */
  private checkAuthStatus(): void {
    try {
      const token = this.getToken();
      const user = this.getStoredUser();

      if (token && user) {
        this.currentUserSubject.next(user);
        this.isAuthenticatedSubject.next(true);
      } else {
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      this.clearAuthData();
    }
  }

  /**
   * Login user
   */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials)
      .pipe(
        tap(response => {
          if (response.status === 'success' && response.data) {
            this.setAuthData(response.data.token, response.data.user);
          }
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Register new user
   */
  register(userData: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.API_URL}/register`, userData)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Logout user
   */
  logout(): Observable<ApiResponse> {
    const headers = this.getAuthHeaders();

    return this.http.post<ApiResponse>(`${this.API_URL}/logout`, {}, { headers })
      .pipe(
        tap(() => {
          this.clearAuthData();
        }),
        catchError((error) => {
          // Even if logout fails on server, clear local data
          this.clearAuthData();
          return throwError(() => error);
        })
      );
  }

  /**
   * Get user profile
   */
  getProfile(): Observable<ApiResponse<User>> {
    const headers = this.getAuthHeaders();

    return this.http.get<ApiResponse<User>>(`${this.API_URL}/profile`, { headers })
      .pipe(
        tap(response => {
          if (response.status === 'success' && response.data) {
            this.setUser(response.data);
          }
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Refresh JWT token
   */
  refreshToken(): Observable<AuthResponse> {
    const headers = this.getAuthHeaders();

    return this.http.post<AuthResponse>(`${this.API_URL}/refresh`, {}, { headers })
      .pipe(
        tap(response => {
          if (response.status === 'success' && response.data) {
            this.setToken(response.data.token);
          }
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Set authentication data
   */
  private setAuthData(token: string, user: User): void {
    this.setToken(token);
    this.setUser(user);
  }

  /**
   * Set JWT token in localStorage
   */
  private setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  /**
   * Set user data in localStorage and update subjects
   */
  private setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
  }

  /**
   * Get JWT token from localStorage
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Get stored user data
   */
  private getStoredUser(): User | null {
    try {
      const userData = localStorage.getItem(this.USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing stored user data:', error);
      // Clear corrupted data
      localStorage.removeItem(this.USER_KEY);
      return null;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Clear authentication data
   */
  private clearAuthData(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  /**
   * Get authorization headers
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<never> {
    let errorMessage = 'An error occurred';

    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    // If token is invalid, clear auth data
    if (error.status === 401) {
      this.clearAuthData();
    }

    console.error('API Error:', error);
    return throwError(() => ({ message: errorMessage, error }));
  }
}
