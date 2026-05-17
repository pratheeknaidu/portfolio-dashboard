import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Server-only flag — never read NEXT_PUBLIC_* server-side to gate Admin SDK
// behavior, since that var is also embedded in the client bundle and changing
// it client-side would have no effect here (but could mislead a reader).
const useEmulator = process.env.USE_EMULATOR === "true";

if (useEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
}

let app: App;

if (getApps().length === 0) {
  if (useEmulator) {
    app = initializeApp({ projectId: "demo-portfolio" });
  } else {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw || raw.trim() === "") {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is not set. Set it in Vercel env vars (production) " +
        "or set USE_EMULATOR=true for local emulator development.",
      );
    }
    app = initializeApp({ credential: cert(JSON.parse(raw)) });
  }
} else {
  app = getApps()[0];
}

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
