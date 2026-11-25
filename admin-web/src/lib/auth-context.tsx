'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiRequest, bindTokenAccessor } from './api-client';
import { AuthUser } from './types';

interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  registerFirstAdmin: (params: {
    email: string;
    username: string;
    displayName: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserFlags: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Keep JWTs strictly in JS memory — never persisted in localStorage/sessionStorage
  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    if (!refreshTokenRef.current) return null;
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const promise = (async () => {
      try {
        const res = await apiRequest<{ accessToken: string; refreshToken: string }>(
          '/auth/refresh',
          {
            method: 'POST',
            body: JSON.stringify({ refreshToken: refreshTokenRef.current }),
          },
          false,
        );
        accessTokenRef.current = res.accessToken;
        refreshTokenRef.current = res.refreshToken;
        return res.accessToken;
      } catch {
        accessTokenRef.current = null;
        refreshTokenRef.current = null;
        setUser(null);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    bindTokenAccessor({
      getAccessToken: () => accessTokenRef.current,
      refreshSession,
    });
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string, mfaCode?: string) => {
    const res = await apiRequest<LoginResponse>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          ...(mfaCode ? { mfaCode } : {}),
          deviceName: 'ConnectX Admin Console',
          platform: 'WEB',
        }),
      },
      false,
    );
    accessTokenRef.current = res.accessToken;
    refreshTokenRef.current = res.refreshToken;
    setUser(res.user);
  }, []);

  const registerFirstAdmin = useCallback(
    async (params: { email: string; username: string; displayName: string; password: string }) => {
      const res = await apiRequest<LoginResponse>(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            ...params,
            deviceName: 'ConnectX Admin Console',
            platform: 'WEB',
          }),
        },
        false,
      );
      accessTokenRef.current = res.accessToken;
      refreshTokenRef.current = res.refreshToken;
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      if (accessTokenRef.current) {
        await apiRequest('/auth/logout', { method: 'POST' }, false);
      }
    } finally {
      accessTokenRef.current = null;
      refreshTokenRef.current = null;
      setUser(null);
    }
  }, []);

  const refreshUserFlags = useCallback(async () => {
    const profile = await apiRequest<AuthUser>('/users/me');
    setUser((prev) => (prev ? { ...prev, ...profile } : profile));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user && accessTokenRef.current),
        login,
        registerFirstAdmin,
        logout,
        refreshUserFlags,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
