import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
    getFirestore, 
    Firestore, 
    doc, 
    getDoc, 
    setDoc, 
    serverTimestamp, 
    updateDoc,
    setLogLevel
} from 'firebase/firestore';

// Initialize Firebase configuration from global variables or defaults
export const appId = typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'default-app-id';
const firebaseConfigStr = typeof window !== 'undefined' && window.__firebase_config ? window.__firebase_config : '{}';
const firebaseConfig = JSON.parse(firebaseConfigStr);
export const initialAuthToken = typeof window !== 'undefined' && window.__initial_auth_token ? window.__initial_auth_token : null;

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    // setLogLevel('debug');
} catch (e) {
    console.error("Firebase Initialization Failed:", e);
}

export { app, auth, db };

export const ensureUserProfile = async (uid: string, email: string) => {
    if (!db) return;
    const profileRef = doc(
        db, 
        'artifacts', 
        appId, 
        'users', 
        uid, 
        'profiles', 
        'user_profile'
    );
    try {
        const profileSnap = await getDoc(profileRef);
        if (!profileSnap.exists()) {
            await setDoc(profileRef, {
                uid: uid,
                email: email,
                displayName: email.split('@')[0],
                createdAt: serverTimestamp(),
                isSetupComplete: true 
            }, { merge: true });
            console.log("[Auth] User profile created.");
        } else {
            await updateDoc(profileRef, {
                lastLogin: serverTimestamp(),
            });
            console.log("[Auth] User profile updated.");
        }
    } catch (error) {
        console.error("[Auth Error] Failed to ensure user profile:", error);
        throw new Error("Missing or insufficient permissions during profile setup. Please check Firestore security rules.");
    }
};
