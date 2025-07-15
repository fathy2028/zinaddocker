<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Tymon\JWTAuth\Facades\JWTAuth;
use Tymon\JWTAuth\Exceptions\JWTException;
use App\Http\Requests\RegisterRequest;
use App\Http\Requests\LoginRequest;
use App\Actions\Auth\CreateUserAction;

class UserController extends Controller
{
    /**
     * Sanitize input to prevent XSS and other malicious content
     */
    private function sanitizeInput($input)
    {
        if (is_array($input)) {
            return array_map([$this, 'sanitizeInput'], $input);
        }

        // Remove HTML tags and encode special characters
        $sanitized = strip_tags($input);
        $sanitized = htmlspecialchars($sanitized, ENT_QUOTES, 'UTF-8');

        // Remove potential SQL injection patterns
        $sanitized = preg_replace('/[\'";\\\\]/', '', $sanitized);

        // Remove script tags and javascript
        $sanitized = preg_replace('/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/mi', '', $sanitized);

        return trim($sanitized);
    }

     // Use throttle middleware for login route
    private function checkRateLimit(Request $request, $key, $maxAttempts = 5, $decayMinutes = 15)
    {
        $rateLimitKey = $key . '|' . $request->ip();

        if (RateLimiter::tooManyAttempts($rateLimitKey, $maxAttempts)) {
            $seconds = RateLimiter::availableIn($rateLimitKey);
            Log::warning('Rate limit exceeded', [
                'ip' => $request->ip(),
                'key' => $key,
                'user_agent' => $request->userAgent()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Too many attempts. Please try again in ' . ceil($seconds / 60) . ' minutes.',
                'retry_after' => $seconds
            ], 429);
        }

        return null;
    }

    /**
     * Log security events
     */
    private function logSecurityEvent($event, $request, $details = [])
    {
        Log::info('Security Event: ' . $event, array_merge([
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'timestamp' => now(),
        ], $details));
    }

    public function register(RegisterRequest $request) {
        try {
            $validatedData = $request->validated();

            $user = User::create([
                'name' => $validatedData['name'],
                'email' => $validatedData['email'],
                'password' => Hash::make($validatedData['password']),
            ]);

            // Remove sensitive data from response
            $userData = [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'created_at' => $user->created_at,
                'updated_at' => $user->updated_at
            ];

            return response()->json([
                'status' => 'success',
                'message' => 'User created successfully',
                'data' => $userData
            ], 201);

        } catch (\Exception $e) {
            $this->logSecurityEvent('Registration failed with exception', $request, [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'User registration failed. Please try again later.',
            ], 500);
        }
    }


    public function login(Request $request)
    {
        try {
            // Check rate limiting for login attempts
            $rateLimitResponse = $this->checkRateLimit($request, 'login', 5, 15);
            if ($rateLimitResponse) {
                return $rateLimitResponse;
            }

            // Validate and sanitize the request data
            $validator = Validator::make($request->all(), [
                'email' => [
                    'required',
                    'string',
                    'email:rfc',
                    'max:255',
                ],
                'password' => [
                    'required',
                    'string',
                    'max:255',
                ],
            ]);

            if ($validator->fails()) {
                RateLimiter::hit('login|' . $request->ip());
                $this->logSecurityEvent('Login validation failed', $request, [
                    'errors' => $validator->errors()->toArray()
                ]);

                return response()->json([
                    'status' => 'error',
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $validatedData = $validator->validated();

            // Sanitize credentials
            $credentials = [
                'email' => strtolower(trim($this->sanitizeInput($validatedData['email']))),
                'password' => $validatedData['password'] // Don't sanitize password
            ];

            // Attempt to create a token
            if (!$token = JWTAuth::attempt($credentials)) {
                RateLimiter::hit('login|' . $request->ip());
                $this->logSecurityEvent('Failed login attempt', $request, [
                    'email' => $credentials['email']
                ]);

                return response()->json([
                    'status' => 'error',
                    'message' => 'Invalid credentials'
                ], 401);
            }

            // Clear rate limiter on successful login
            RateLimiter::clear('login|' . $request->ip());

            // Get the authenticated user
            $user = auth()->user();
            $userData = [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'email_verified_at' => $user->email_verified_at,
                'created_at' => $user->created_at,
                'updated_at' => $user->updated_at
            ];

            $this->logSecurityEvent('User logged in successfully', $request, [
                'user_id' => $user->id,
                'email' => $user->email
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Login successful',
                'data' => [
                    'user' => $userData,
                    'token' => $token,
                    'token_type' => 'bearer',
                    'expires_in' => config('jwt.ttl') * 60
                ]
            ]);

        } catch (JWTException $e) {
            RateLimiter::hit('login|' . $request->ip());
            $this->logSecurityEvent('JWT exception during login', $request, [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Authentication service temporarily unavailable'
            ], 500);
        } catch (\Illuminate\Validation\ValidationException $e) {
            RateLimiter::hit('login|' . $request->ip());
            $this->logSecurityEvent('Login validation exception', $request, [
                'errors' => $e->errors()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            RateLimiter::hit('login|' . $request->ip());
            $this->logSecurityEvent('Login failed with exception', $request, [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Login failed. Please try again later.'
            ], 500);
        }
    }

    /**
     * Get the authenticated user profile
     */
    public function profile(Request $request)
    {
        try {
            $user = auth()->user();

            if (!$user) {
                $this->logSecurityEvent('Profile access with invalid user', $request);
                return response()->json([
                    'status' => 'error',
                    'message' => 'User not found'
                ], 404);
            }

            // Remove sensitive data from response
            $userData = [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'email_verified_at' => $user->email_verified_at,
                'created_at' => $user->created_at,
                'updated_at' => $user->updated_at
            ];

            $this->logSecurityEvent('Profile accessed successfully', $request, [
                'user_id' => $user->id
            ]);

            return response()->json([
                'status' => 'success',
                'data' => $userData
            ]);
        } catch (JWTException $e) {
            $this->logSecurityEvent('Profile access with invalid token', $request, [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Token is invalid'
            ], 401);
        } catch (\Exception $e) {
            $this->logSecurityEvent('Profile access failed with exception', $request, [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Unable to retrieve profile'
            ], 500);
        }
    }

    /**
     * Logout user (invalidate token)
     */
    public function logout(Request $request)
    {
        try {
            $user = auth()->user();
            $userId = $user ? $user->id : null;

            JWTAuth::invalidate(JWTAuth::getToken());

            $this->logSecurityEvent('User logged out successfully', $request, [
                'user_id' => $userId
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Successfully logged out'
            ]);
        } catch (JWTException $e) {
            $this->logSecurityEvent('Logout failed with JWT exception', $request, [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Failed to logout'
            ], 500);
        } catch (\Exception $e) {
            $this->logSecurityEvent('Logout failed with exception', $request, [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Logout failed'
            ], 500);
        }
    }

    /**
     * Refresh JWT token
     */
    public function refresh(Request $request)
    {
        try {
            $user = auth()->user();
            $userId = $user ? $user->id : null;

            $token = JWTAuth::refresh(JWTAuth::getToken());

            $this->logSecurityEvent('Token refreshed successfully', $request, [
                'user_id' => $userId
            ]);

            return response()->json([
                'status' => 'success',
                'data' => [
                    'token' => $token,
                    'token_type' => 'bearer',
                    'expires_in' => config('jwt.ttl') * 60
                ]
            ]);
        } catch (JWTException $e) {
            $this->logSecurityEvent('Token refresh failed', $request, [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Token cannot be refreshed'
            ], 401);
        } catch (\Exception $e) {
            $this->logSecurityEvent('Token refresh failed with exception', $request, [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Token refresh failed'
            ], 500);
        }
    }
}
