import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getUserId } from '../lib/localStorage';

interface User {
  id: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auto-login with stored user ID (simple local auth)
    const userId = getUserId();
    setUser({ id: userId });
    setLoading(false);
  }, []);

  const signUp = async (email: string, password: string) => {
    // Simple local auth - just generate a new user ID
    const userId = getUserId();
    setUser({ id: userId, email });
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    // Simple local auth - just use existing or create new user ID
    const userId = getUserId();
    setUser({ id: userId, email });
    return { error: null };
  };

  const signOut = async () => {
    // Clear user session (keep user ID for next login)
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
