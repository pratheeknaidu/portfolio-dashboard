import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

const useEmulator = process.env.USE_EMULATOR === "true";

if (useEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
}

let _app: App | null = null;

function getApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) { _app = getApps()[0]; return _app; }

  if (useEmulator) {
    _app = initializeApp({ projectId: "demo-portfolio" });
    return _app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || raw.trim() === "") {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is not set. Set it in Vercel env vars (production) " +
      "or set USE_EMULATOR=true for local emulator development.",
    );
  }
  _app = initializeApp({ credential: cert(JSON.parse(raw)) });
  return _app;
}

/**
 * Lazy proxy: defers Firebase Admin initialization until first property
 * access. Without this, importing the module triggers init at build time
 * (Next.js's "Collecting page data" phase), which fails when secrets
 * aren't available in the build env. The proxy also bind()s returned
 * functions so SDK methods retain their `this` receiver.
 */
function lazy<T extends object>(factory: () => T): T {
  let target: T | null = null;
  return new Proxy({} as T, {
    get(_, prop) {
      if (!target) target = factory();
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const adminDb: Firestore = lazy(() => getFirestore(getApp()));
export const adminAuth: Auth = lazy(() => getAuth(getApp()));
