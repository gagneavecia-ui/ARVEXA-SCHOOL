// auth.js - Gestion centralisée de l'authentification
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  setPersistence, 
  browserLocalPersistence,
  signOut
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHscOXw3rLuhV6z1Cny-bdYCumqpnG7QE",
  authDomain: "arvexa-fbf10.firebaseapp.com",
  projectId: "arvexa-fbf10",
  storageBucket: "arvexa-fbf10.firebasestorage.app",
  messagingSenderId: "920108330053",
  appId: "1:920108330053:web:f532d71cbc2c824bc7472c"
};

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

// Fonction principale : protéger les pages et gérer les redirections
export function protectPage(callback) {
  onAuthStateChanged(auth, (user) => {
    const isPublic = isPublicPage();
    
    if (!user && !isPublic) {
      // Non connecté sur une page protégée → rediriger vers login
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
      window.location.href = 'login.html';
      return;
    }
    
    if (user && isPublic) {
      // Connecté sur une page publique → rediriger vers l'accueil
      window.location.href = 'index.html';
      return;
    }
    
    // Tout est bon, exécuter le callback avec l'utilisateur
    if (callback) {
      callback(user);
    }
  });
}

// Exporter l'instance auth pour les cas où on en a besoin
export function getAuthInstance() {
  return auth;
}

// Fonction de déconnexion
export function logout() {
  return signOut(auth);
}

console.log('🔐 Auth module chargé');
