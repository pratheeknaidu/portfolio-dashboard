"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase-client";
import { SANDBOX_USER_EMAIL, SANDBOX_USER_PASSWORD } from "./sandbox-constants";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInAsSandbox: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    signIn: () => signInWithPopup(auth, googleProvider).then(() => {}),
    signInAsSandbox: () =>
      signInWithEmailAndPassword(auth, SANDBOX_USER_EMAIL, SANDBOX_USER_PASSWORD).then(() => {}),
    signOut: () => signOut(auth),
    getIdToken: async () => user?.getIdToken() ?? null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
