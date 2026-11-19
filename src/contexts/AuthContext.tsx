import { useEffect, useState, ReactNode } from 'react';
import { clearSession, getSession, getUserId, getUserIdForEmail, saveSession } from '../lib/localStorage';
import { AuthContext, User } from './useAuth';

// Local demo auth: there is no backend, so passwords are NOT stored or verified.
// Each email maps to its own local profile, so different people on the same
// browser keep separate trips and preferences. Without signing in, the app
// runs as an anonymous guest profile.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

function validate(email: string, password: string): string | null {
  if (!EMAIL_RE.test(email.trim())) return 'Please enter a valid email address.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore the last session, or start as the anonymous guest profile.
    setUser(getSession() ?? { id: getUserId() });
    setLoading(false);
  }, []);

  const startSession = (email: string, password: string) => {
    const error = validate(email, password);
    if (error) return { error };
    const normalized = email.trim().toLowerCase();
    const session: User = { id: getUserIdForEmail(normalized), email: normalized };
    saveSession(session);
    setUser(session);
    return { error: null };
  };

  const signUp = async (email: string, password: string) => startSession(email, password);
  const signIn = async (email: string, password: string) => startSession(email, password);

  const signOut = async () => {
    clearSession();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
