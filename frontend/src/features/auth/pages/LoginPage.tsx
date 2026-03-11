/**
 * LoginPage Component
 * 
 * Public login page for user authentication
 * Matches Figma design with UniMentee branding
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, LogIn } from 'lucide-react';
import api from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';
import { getHomeRoute } from '../../../lib/roleRoutes';

// Zod validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// API response types
interface LoginResponse {
  access_token: string;
  token_type: string;
}

interface UserMeResponse {
  user_id: number;
  university_id: number;
  full_name: string;
  email: string;
  permissions: string[];
  roles: string[];
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      // Step 1: POST /auth/login
      const loginResponse = await api.post<LoginResponse>('/auth/login', {
        email: data.email,
        password: data.password,
      });

      const token = loginResponse.data.access_token;

      // Step 2: GET /auth/me using returned token
      const meResponse = await api.get<UserMeResponse>('/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const userData = meResponse.data;
      
      // Get the primary role (first role in the array)
      const role = userData.roles[0] || '';

      // Step 3: authStore.setAuth(token, userId, universityId, role, permissions)
      setAuth(
        token,
        userData.user_id,
        userData.university_id,
        role,
        userData.permissions
      );

      // Step 4: navigate(getHomeRoute(role))
      navigate(getHomeRoute(role));
    } catch (error: any) {
      // On 401: show inline error "Invalid credentials"
      if (error.response?.status === 401) {
        setAuthError('Invalid credentials');
      } else {
        setAuthError('An error occurred. Please try again.');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] font-display">
      <div className="w-full max-w-[520px] mx-4">
        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-sm p-12">
          {/* Logo and Title */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-6">
              <GraduationCap className="w-8 h-8 text-primary" strokeWidth={2} />
              <span className="text-2xl font-bold text-gray-900">UniERP</span>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-sm text-gray-500">Sign in to your university account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <span className="text-gray-400">@</span>
                University Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@university.edu"
                {...register('email')}
                className={`w-full px-4 py-3 bg-gray-50 border ${
                  errors.email ? 'border-red-500' : 'border-gray-200'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-gray-900 placeholder-gray-400`}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <span className="text-gray-400">🔒</span>
                  Password
                </label>
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password')}
                  className={`w-full px-4 py-3 bg-gray-50 border ${
                    errors.password ? 'border-red-500' : 'border-gray-200'
                  } rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-gray-900 placeholder-gray-400 pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Keep me logged in */}
            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-gray-600">
                Keep me logged in
              </label>
            </div>

            {/* Auth Error */}
            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-medium">{authError}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Login to Portal</span>
                  <LogIn className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 flex items-center justify-center gap-6 text-sm">
            <button className="text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1">
              <span className="text-primary">ⓘ</span>
              Help Desk
            </button>
            <span className="text-gray-300">|</span>
            <button className="text-gray-500 hover:text-gray-700 transition-colors">
              Privacy Policy
            </button>
            <span className="text-gray-300">|</span>
            <button className="text-gray-500 hover:text-gray-700 transition-colors">
              Terms
            </button>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            © 2024 UniERP Systems. All rights reserved.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Managed by University IT Services.
          </p>
        </div>
      </div>
    </div>
  );
}
