"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAccessToken, clearTokens, setTokens } from "@/lib/api/config";
import { getProfile } from "@/lib/api/users";
import { logout as apiLogout } from "@/lib/api/auth";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  fullName: string;
  email: string;
  avatar: string;
  storageUsed: number;
  storageLimit: number;
  storageUsedPercent: string;
  isVerified: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string, user: User) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const result = await getProfile();
      if (result.success) {
        setUser(result.data);
      } else {
        setUser(null);
        clearTokens();
      }
    } catch {
      setUser(null);
      clearTokens();
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check for existing tokens on mount
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback((accessToken: string, refreshToken: string, userData: User) => {
    setTokens(accessToken, refreshToken);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    router.push("/sign-in");
  }, [router]);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
