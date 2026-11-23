import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    gender?: string;
    medicalHistory?: string;
  }) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (payload: Partial<User>) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = sessionStorage.getItem('physiocare_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<{ user: User }>('/auth/me');
      setUser(data.user);
    } catch {
      sessionStorage.removeItem('physiocare_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<User> => {
    const { data } = await api.post<{ token: string; user: User }>('/auth/login', {
      email,
      password,
    });
    sessionStorage.setItem('physiocare_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    gender?: string;
    medicalHistory?: string;
  }): Promise<User> => {
    const { data } = await api.post<{ token: string; user: User }>('/auth/register', payload);
    sessionStorage.setItem('physiocare_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    sessionStorage.removeItem('physiocare_token');
    setUser(null);
  };

  const updateProfile = async (payload: Partial<User>): Promise<User> => {
    const { data } = await api.put<{ user: User }>('/auth/profile', payload);
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
