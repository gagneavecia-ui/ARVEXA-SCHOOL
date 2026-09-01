// ================================================================
// auth.js - Gestion centralisée de l'authentification
// Version corrigée - Problème de boucle de redirection résolu
// ================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  setPersistence, 
  browserLocalPersistence,
  browserSessionPersistence,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  fetchSignInMethodsForEmail,
  deleteUser
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// ================================================================
// FIREBASE CONFIG
// ================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDHscOXw3rLuhV6z1Cny-bdYCumqpnG7QE",
  authDomain: "arvexa-fbf10.firebaseapp.com",
  projectId: "arvexa-fbf10",
  storageBucket: "arvexa-fbf10.firebasestorage.app",
  messagingSenderId: "920108330053",
  appId: "1:920108330053:web:f532d71cbc2c824bc7472c"
};

// ================================================================
// INITIALISATION
// ================================================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================================================================
// PERSISTANCE
// ================================================================
let persistenceInitialized = false;

export async function initPersistence(type = 'local') {
  if (persistenceInitialized) return;
  try {
    const persistence = type === 'session' ? browserSessionPersistence : browserLocalPersistence;
    await setPersistence(auth, persistence);
    persistenceInitialized = true;
    console.log(`🔐 Persistance ${type} activée`);
  } catch (error) {
    console.error('❌ Erreur persistance:', error);
    throw error;
  }
}

await initPersistence('local');

// ================================================================
// PAGES PUBLIQUES
// ================================================================
const PUBLIC_PAGES = [
  'login.html', 
  'register.html', 
  'bienvenue.html', 
  'forgot-password.html',
  'reset-password.html',
  'onboarding.html'
];

function isPublicPage() {
  const path = window.location.pathname;
  const filename = path.split('/').pop() || 'index.html';
  return PUBLIC_PAGES.includes(filename);
}

// ================================================================
// SESSION UTILITIES
// ================================================================

export function saveSession(user) {
  if (!user) return;
  try {
    const sessionData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      lastLogin: new Date().toISOString()
    };
    localStorage.setItem('arvexa_session', JSON.stringify(sessionData));
  } catch (error) {
    console.warn('⚠️ Impossible de sauvegarder la session:', error);
  }
}

export function getSession() {
  try {
    const data = localStorage.getItem('arvexa_session');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem('arvexa_session');
    localStorage.removeItem('arvexa_remember_email');
    localStorage.removeItem('arvexa_user_data');
    // Nettoyer toutes les données de session
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('arvexa_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('⚠️ Impossible d\'effacer la session:', error);
  }
}

// ================================================================
// VARIABLES POUR ÉVITER LES BOUCLES
// ================================================================
let isRedirecting = false;
let lastRedirectTime = 0;
const REDIRECT_COOLDOWN = 3000; // 3 secondes entre les redirections
let authStateChecked = false;

// ================================================================
// FONCTION PRINCIPALE PROTECTPAGE (CORRIGÉE)
// ================================================================

export function protectPage(callback, redirectTo = 'login.html') {
  // Éviter les appels multiples
  if (authStateChecked) {
    console.log('⏳ Auth déjà vérifié, skip');
    return;
  }
  
  onAuthStateChanged(auth, async (user) => {
    const isPublic = isPublicPage();
    const currentPath = window.location.pathname;
    const currentFilename = currentPath.split('/').pop() || 'index.html';
    
    // Marquer comme vérifié
    authStateChecked = true;
    
    // Vérifier si on est en train de rediriger pour éviter les boucles
    if (isRedirecting) {
      console.log('⏳ Redirection en cours, ignoré');
      return;
    }
    
    // Vérifier le cooldown pour éviter les redirections en boucle
    const now = Date.now();
    if (now - lastRedirectTime < REDIRECT_COOLDOWN) {
      console.log('⏳ Cooldown actif, ignoré');
      return;
    }
    
    // Cas 1 : Non connecté sur une page protégée
    if (!user && !isPublic) {
      console.log('🔒 Non connecté, redirection vers', redirectTo);
      isRedirecting = true;
      lastRedirectTime = now;
      sessionStorage.setItem('redirectAfterLogin', currentPath + window.location.search);
      setTimeout(() => {
        window.location.href = redirectTo;
        setTimeout(() => { isRedirecting = false; }, 1000);
      }, 100);
      return;
    }
    
    // Cas 2 : Connecté sur une page publique (login, register, etc.)
    if (user && isPublic) {
      // Vérifier que la redirection est nécessaire
      const redirectPath = sessionStorage.getItem('redirectAfterLogin') || 'index.html';
      
      // Ne pas rediriger si on est déjà sur la page de destination
      if (currentFilename === redirectPath || currentFilename === 'index.html') {
        sessionStorage.removeItem('redirectAfterLogin');
        if (callback) callback(user);
        return;
      }
      
      console.log('✅ Connecté sur page publique, redirection vers', redirectPath);
      isRedirecting = true;
      lastRedirectTime = now;
      sessionStorage.removeItem('redirectAfterLogin');
      setTimeout(() => {
        window.location.href = redirectPath;
        setTimeout(() => { isRedirecting = false; }, 1000);
      }, 100);
      return;
    }
    
    // Cas 3 : Connecté sur une page protégée
    if (user && !isPublic) {
      // Mettre à jour la session
      saveSession(user);
      
      // Vérifier Firestore
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          console.warn('⚠️ Utilisateur dans Auth mais pas dans Firestore');
        }
      } catch (error) {
        console.error('❌ Erreur vérification Firestore:', error);
      }
    }
    
    // Réinitialiser le flag
    authStateChecked = false;
    
    // Tout est bon, exécuter le callback
    if (callback) {
      callback(user);
    }
  });
}

// ================================================================
// DÉCONNEXION (CORRIGÉE)
// ================================================================

export async function logout() {
  try {
    // Éviter les redirections pendant la déconnexion
    isRedirecting = true;
    authStateChecked = false;
    
    // Effacer la session
    clearSession();
    
    // Effacer les données de l'utilisateur
    sessionStorage.removeItem('redirectAfterLogin');
    
    // Déconnecter
    await signOut(auth);
    
    console.log('👋 Déconnexion réussie');
    
    // Réinitialiser après un délai
    setTimeout(() => { 
      isRedirecting = false; 
    }, 1500);
    
    // Rediriger vers login
    window.location.href = 'login.html';
    
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur déconnexion:', error);
    isRedirecting = false;
    authStateChecked = false;
    return { success: false, message: error.message };
  }
}

// ================================================================
// FORCER LA DÉCONNEXION (UTILISÉ POUR LES ERREURS CRITIQUES)
// ================================================================

export async function forceLogout() {
  try {
    isRedirecting = true;
    authStateChecked = false;
    clearSession();
    sessionStorage.removeItem('redirectAfterLogin');
    await signOut(auth);
    // Rediriger sans délai
    window.location.replace('login.html');
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur déconnexion forcée:', error);
    window.location.replace('login.html');
    return { success: false, message: error.message };
  }
}

// ================================================================
// AUTRES FONCTIONS
// ================================================================

export function getAuthInstance() {
  return auth;
}

export function getFirestoreInstance() {
  return db;
}

export async function checkEmailExists(email) {
  if (!email || !email.trim()) return false;
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email.trim());
    return methods.length > 0;
  } catch (error) {
    console.error('❌ Erreur vérification email:', error);
    return false;
  }
}

export async function sendVerificationEmail(user) {
  if (!user) throw new Error('Utilisateur non connecté');
  try {
    await sendEmailVerification(user, {
      url: window.location.origin + '/login.html',
      handleCodeInApp: false
    });
    return { success: true, message: 'Email de vérification envoyé' };
  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    return { success: false, message: error.message };
  }
}

export async function sendPasswordReset(email) {
  if (!email || !email.trim()) {
    return { success: false, message: 'Email requis' };
  }
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return { success: true, message: 'Email de réinitialisation envoyé' };
  } catch (error) {
    console.error('❌ Erreur réinitialisation:', error);
    let message = 'Erreur lors de l\'envoi';
    switch (error.code) {
      case 'auth/user-not-found':
        message = 'Aucun compte trouvé avec cette adresse';
        break;
      case 'auth/invalid-email':
        message = 'Adresse email invalide';
        break;
      default:
        message = error.message;
    }
    return { success: false, message };
  }
}

export async function updateUserProfile(user, data) {
  if (!user) throw new Error('Utilisateur non connecté');
  try {
    if (data.displayName) {
      await updateProfile(user, { displayName: data.displayName });
    }
    if (data.photoURL) {
      await updateProfile(user, { photoURL: data.photoURL });
    }
    if (data.uid) {
      const userRef = doc(db, 'users', data.uid);
      await updateDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    }
    return { success: true, message: 'Profil mis à jour' };
  } catch (error) {
    console.error('❌ Erreur mise à jour profil:', error);
    return { success: false, message: error.message };
  }
}

export async function deleteUserAccount(user) {
  if (!user) throw new Error('Utilisateur non connecté');
  try {
    await deleteDoc(doc(db, 'users', user.uid));
    await deleteUser(user);
    return { success: true, message: 'Compte supprimé' };
  } catch (error) {
    console.error('❌ Erreur suppression:', error);
    return { success: false, message: error.message };
  }
}

export async function refreshUserToken() {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('Aucun utilisateur connecté');
    const token = await user.getIdToken(true);
    return { success: true, token };
  } catch (error) {
    console.error('❌ Erreur rafraîchissement token:', error);
    return { success: false, message: error.message };
  }
}

export async function checkUserPremium(user) {
  if (!user) return false;
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) return false;
    const data = userDoc.data();
    return data.premium === true || data.isUnlocked === true || data.hasDeposited === true;
  } catch (error) {
    console.error('❌ Erreur vérification premium:', error);
    return false;
  }
}

export async function getUserData(user) {
  if (!user) return null;
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) return null;
    return userDoc.data();
  } catch (error) {
    console.error('❌ Erreur récupération données:', error);
    return null;
  }
}

// ================================================================
// GESTION DES ERREURS
// ================================================================

export function getFirebaseErrorMessage(errorCode) {
  const messages = {
    'auth/user-not-found': '❌ Aucun compte trouvé avec cette adresse',
    'auth/wrong-password': '❌ Mot de passe incorrect',
    'auth/invalid-email': '❌ Adresse e-mail invalide',
    'auth/too-many-requests': '⏳ Trop de tentatives. Réessaie dans quelques minutes',
    'auth/network-request-failed': '📶 Problème de connexion réseau',
    'auth/email-already-in-use': '⚠️ Cette adresse e-mail est déjà utilisée',
    'auth/weak-password': '🔒 Le mot de passe doit contenir au moins 6 caractères',
    'auth/user-disabled': '🚫 Ce compte a été désactivé',
    'auth/requires-recent-login': '⏰ Veuillez vous reconnecter pour cette action',
    'auth/operation-not-allowed': '⛔ Cette opération n\'est pas autorisée',
    'auth/expired-action-code': '⏳ Le lien a expiré. Veuillez réessayer',
    'auth/invalid-action-code': '❌ Lien invalide. Veuillez réessayer',
    'auth/user-mismatch': '❌ Cette action ne correspond pas à votre compte',
    'auth/credential-already-in-use': '⚠️ Ce compte est déjà lié à un autre utilisateur',
    'auth/invalid-credential': '❌ Identifiants invalides',
    'auth/missing-email': '📧 Veuillez entrer votre adresse e-mail',
    'auth/missing-password': '🔑 Veuillez entrer votre mot de passe',
    'auth/unverified-email': '📧 Veuillez vérifier votre adresse e-mail',
    'auth/account-exists-with-different-credential': '⚠️ Un compte existe déjà avec cette adresse'
  };
  return messages[errorCode] || `❌ Erreur: ${errorCode}`;
}

// ================================================================
// EXPORT PAR DÉFAUT
// ================================================================

console.log('🔐 Auth module chargé (version corrigée - boucles résolues)');

export default {
  auth,
  db,
  protectPage,
  logout,
  forceLogout,
  getAuthInstance,
  getFirestoreInstance,
  initPersistence,
  saveSession,
  getSession,
  clearSession,
  checkEmailExists,
  sendVerificationEmail,
  sendPasswordReset,
  updateUserProfile,
  deleteUserAccount,
  refreshUserToken,
  checkUserPremium,
  getUserData,
  getFirebaseErrorMessage
};