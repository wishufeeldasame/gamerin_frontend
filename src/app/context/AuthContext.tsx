'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { removeAccessToken } from '@/lib/auth-store';

// 유저 데이터 타입 (필요한 정보를 추가하세요)
interface User {
  id: string;
  name: string;
  nickname: string;
  gameTier: string;
  bio?: string;
  handle?: string; 
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // 1. 브라우저가 켜질 때 로컬 스토리지에서 로그인 정보가 있는지 확인합니다.
    const savedUser = localStorage.getItem('gamerin_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = (userData: User) => {
    // 2. 로그인 성공 시 유저 정보를 저장합니다.
    setUser(userData);
    localStorage.setItem('gamerin_user', JSON.stringify(userData));
  };


  const logout = () => {
    // 3. 로그아웃 시 정보와 토큰을 함께 완벽하게 삭제합니다.
    setUser(null);
    localStorage.removeItem('gamerin_user');
    removeAccessToken();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
