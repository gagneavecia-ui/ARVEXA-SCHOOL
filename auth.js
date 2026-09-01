// auth.js - Version avec variables d'environnement Vercel
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  setPersistence, 
  browserLocalPersistence,
  signOut,
  getIdToken
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

// ✅ UTILISER LES VARIABLES D'ENVIRONNEMENT
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// ✅ VÉRIFICATION QUE LES VARIABLES SONT CHARGÉES
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'undefined') {
  console.error('❌ Firebase config manquante. Vérifiez vos variables d\'environnement.');
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Activer la persistance locale
await setPersistence(auth, browserLocalPersistence);

// Pages qui ne nécessitent PAS d'authentification
const PUBLIC_PAGES = ['login.html', 'register.html', 'bienvenue.html', 'forgot-password.html'];

// Détecter si la page actuelle est publique
function isPublicPage() {
  const path = window.location.pathname;
  const filename = path.split('/').pop() || 'index.html';
  return PUBLIC_PAGES.includes(filename);
}

// ✅ FONCTION PRINCIPALE AVEC RENOUVELLEMENT DE TOKEN
export function protectPage(callback) {
  onAuthStateChanged(auth, async (user) => {
    const isPublic = isPublicPage();
    
    if (!user && !isPublic) {
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
      window.location.href = 'login.html';
      return;
    }
    
    if (user && isPublic) {
      const redirect = sessionStorage.getItem('redirectAfterLogin') || 'index.html';
      sessionStorage.removeItem('redirectAfterLogin');
      window.location.href = redirect;
      return;
    }
    
    if (user) {
      // ✅ RENOUVELLER LE TOKEN TOUTES LES 30 MINUTES
      try {
        const token = await getIdToken(user, true);
        sessionStorage.setItem('firebaseToken', token);
      } catch (error) {
        console.error('Erreur de token:', error);
      }
    }
    
    if (callback) {
      callback(user);
    }
  });
}

// Exporter l'instance auth
export function getAuthInstance() {
  return auth;
}

// Fonction de déconnexion
export function logout() {
  return signOut(auth);
}

// ✅ OBTENIR LE TOKEN ACTUEL
export async function getCurrentToken() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await getIdToken(user, true);
  } catch {
    return null;
  }
}

console.log('🔐 Auth module chargé (Vercel)');