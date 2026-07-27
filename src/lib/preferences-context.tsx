"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const CVD_KEY = "pref:cvd";

interface Preferences {
  /** Colourblind ramp: blue = gain, orange = loss. */
  cvd: boolean;
  setCvd: (v: boolean) => void;
}

const PreferencesContext = createContext<Preferences>({
  cvd: false,
  setCvd: () => {},
});

/**
 * Device-level display preferences, backed by localStorage rather than
 * Firestore — they must not cost a network round trip on first paint, and they
 * are properly per-device rather than per-account.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  // Starts false on both server and first client render so hydration matches;
  // the stored value is applied in the effect below.
  const [cvd, setCvdState] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(CVD_KEY) === "true") setCvdState(true);
    } catch {
      // Private browsing or a blocked-storage policy. The default is fine.
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-cvd", String(cvd));
  }, [cvd]);

  const setCvd = useCallback((v: boolean) => {
    setCvdState(v);
    try {
      window.localStorage.setItem(CVD_KEY, String(v));
    } catch {
      // Preference still applies for this session.
    }
  }, []);

  return (
    <PreferencesContext.Provider value={{ cvd, setCvd }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): Preferences {
  return useContext(PreferencesContext);
}
