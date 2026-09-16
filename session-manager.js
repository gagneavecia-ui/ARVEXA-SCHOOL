// ================================================================
// session-manager.js — ARVEXA School
// Gestion des sessions et limitation d'appareils
// ================================================================

import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// ================================================================
// CONSTANTES
// ================================================================
const MAX_DEVICES_FREE = 1;
const MAX_DEVICES_PREMIUM = 5;
const SESSION_STORAGE_KEY = 'arvexa_session_id';
const SESSION_INACTIVE_DAYS = 30;

// ================================================================
// DÉTECTION D'APPAREIL
// ================================================================
export function getDeviceInfo() {
  try {
    const ua = navigator.userAgent || '';

    // Type
    let type = 'desktop';
    if (/iPad|Tablet/i.test(ua)) {
      type = 'tablet';
    } else if (/Mobi|Android|iPhone|iPod/i.test(ua)) {
      type = 'mobile';
    }

    // OS
    let os = 'Inconnu';
    if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/Windows/.test(ua)) os = 'Windows';
    else if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) os = 'macOS';
    else if (/Linux/.test(ua)) os = 'Linux';

    // Navigateur
    let browser = 'Inconnu';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
    else if (/Chrome/.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
    else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
    else if (/Firefox/.test(ua)) browser = 'Firefox';

    // Nom lisible
    let name = 'Appareil';
    let icon = '💻';

    if (type === 'mobile') {
      if (os === 'iOS') { name = 'iPhone'; icon = '📱'; }
      else if (os === 'Android') { name = 'Android'; icon = '📱'; }
      else { name = 'Mobile'; icon = '📱'; }
    } else if (type === 'tablet') {
      if (os === 'iOS') { name = 'iPad'; icon = '📲'; }
      else { name = 'Tablette'; icon = '📲'; }
    } else {
      if (os === 'macOS') { name = 'MacBook'; icon = '💻'; }
      else if (os === 'Windows') { name = 'PC Windows'; icon = '🖥️'; }
      else if (os === 'Linux') { name = 'PC Linux'; icon = '🖥️'; }
      else { name = 'Ordinateur'; icon = '💻'; }
    }

    return {
      type,
      os,
      browser,
      name,
      icon,
      displayName: `${name} · ${browser}`,
      userAgent: ua.substring(0, 200)
    };
  } catch (e) {
    console.error('❌ Erreur getDeviceInfo:', e);
    return {
      type: 'unknown',
      os: 'Unknown',
      browser: 'Unknown',
      name: 'Appareil',
      icon: '💻',
      displayName: 'Appareil · Inconnu',
      userAgent: ''
    };
  }
}

// ================================================================
// GESTION DU SESSION ID LOCAL
// ================================================================
export function getLocalSessionId() {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch (e) {
    console.warn('⚠️ Erreur getLocalSessionId:', e);
    return null;
  }
}

export function setLocalSessionId(sessionId) {
  try {
    if (sessionId) {
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }
  } catch (e) {
    console.warn('⚠️ Erreur setLocalSessionId:', e);
  }
}

export function clearLocalSessionId() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {
    console.warn('⚠️ Erreur clearLocalSessionId:', e);
  }
}

// ================================================================
// GÉNÉRATION UUID
// ================================================================
function generateSessionId() {
  try {
    if (crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback
    return 'sess_' +
      Date.now().toString(36) + '_' +
      Math.random().toString(36).substring(2, 10) + '_' +
      Math.random().toString(36).substring(2, 10);
  } catch (e) {
    console.error('❌ Erreur generateSessionId:', e);
    return 'sess_' + Date.now().toString(36);
  }
}

// ================================================================
// LIMITE SELON PLAN
// ================================================================
export function getMaxDevices(userData) {
  try {
    if (!userData) return MAX_DEVICES_FREE;

    const hasPremium = userData.premium === true ||
                       userData.isUnlocked === true ||
                       userData.hasDeposited === true;

    if (!hasPremium) return MAX_DEVICES_FREE;

    // Vérifier la date d'expiration
    let endDate = userData.subscriptionEndDate;
    if (endDate && typeof endDate.toDate === 'function') {
      endDate = endDate.toDate();
    } else if (endDate && endDate.seconds !== undefined) {
      endDate = new Date(endDate.seconds * 1000);
    } else if (endDate && typeof endDate === 'string') {
      endDate = new Date(endDate);
    }

    if (endDate && !isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
      // Expiré → retour au plan gratuit
      return MAX_DEVICES_FREE;
    }

    return MAX_DEVICES_PREMIUM;
  } catch (e) {
    console.error('❌ Erreur getMaxDevices:', e);
    return MAX_DEVICES_FREE;
  }
}

// ================================================================
// NETTOYAGE DES SESSIONS INACTIVES
// ================================================================
function isSessionExpired(lastSeenTimestamp) {
  try {
    if (!lastSeenTimestamp) return true;

    let lastSeen;
    if (typeof lastSeenTimestamp.toDate === 'function') {
      lastSeen = lastSeenTimestamp.toDate();
    } else if (lastSeenTimestamp.seconds !== undefined) {
      lastSeen = new Date(lastSeenTimestamp.seconds * 1000);
    } else if (typeof lastSeenTimestamp === 'string') {
      lastSeen = new Date(lastSeenTimestamp);
    } else {
      lastSeen = lastSeenTimestamp;
    }

    if (!lastSeen || isNaN(lastSeen.getTime())) return true;

    const diffDays = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > SESSION_INACTIVE_DAYS;
  } catch (e) {
    console.error('❌ Erreur isSessionExpired:', e);
    return true;
  }
}

// ================================================================
// NETTOYER LES SESSIONS EXPIRÉES
// ================================================================
async function cleanupExpiredSessions(db, userId, sessions) {
  try {
    if (!sessions || !Array.isArray(sessions)) return [];
    
    const expired = sessions.filter(s => s && isSessionExpired(s.lastSeen));

    for (const session of expired) {
      try {
        if (session && session.id) {
          await deleteDoc(
            doc(db, 'users', userId, 'activeSessions', session.id)
          );
        }
      } catch (e) {
        console.warn('⚠️ Erreur suppression session expirée:', e);
      }
    }

    return sessions.filter(s => s && !isSessionExpired(s.lastSeen));
  } catch (e) {
    console.error('❌ Erreur cleanupExpiredSessions:', e);
    return sessions || [];
  }
}

// ================================================================
// RÉCUPÉRER LES SESSIONS ACTIVES
// ================================================================
export async function getActiveSessions(db, userId) {
  try {
    if (!db || !userId) return [];
    
    const sessionsRef = collection(db, 'users', userId, 'activeSessions');
    const snapshot = await getDocs(sessionsRef);

    const sessions = [];
    snapshot.forEach(d => {
      if (d && d.id && d.data) {
        sessions.push({ id: d.id, ...d.data() });
      }
    });

    // Trier par date de dernière activité (plus récent en premier)
    sessions.sort((a, b) => {
      try {
        const aTime = a.lastSeen?.toDate?.() || new Date(0);
        const bTime = b.lastSeen?.toDate?.() || new Date(0);
        return bTime - aTime;
      } catch (e) {
        return 0;
      }
    });

    return sessions;
  } catch (e) {
    console.error('❌ Erreur getActiveSessions:', e);
    return [];
  }
}

// ================================================================
// VÉRIFIER ET ENREGISTRER LA SESSION
// ================================================================
export async function checkAndRegisterSession(db, userId, userData) {
  try {
    if (!db || !userId) {
      return {
        allowed: false,
        reason: 'INVALID_PARAMS',
        maxDevices: MAX_DEVICES_FREE
      };
    }
    
    const maxDevices = getMaxDevices(userData);
    const currentSessionId = getLocalSessionId();

    // 1. Récupérer les sessions
    let sessions = await getActiveSessions(db, userId);
    if (!Array.isArray(sessions)) sessions = [];

    // 2. Nettoyer les expirées
    sessions = await cleanupExpiredSessions(db, userId, sessions);

    // 3. Si une session locale existe déjà et est valide → OK (même appareil)
    if (currentSessionId) {
      const existing = sessions.find(s => s && s.id === currentSessionId);
      if (existing) {
        // Mettre à jour lastSeen
        try {
          await updateDoc(
            doc(db, 'users', userId, 'activeSessions', currentSessionId),
            { lastSeen: serverTimestamp() }
          );
        } catch (e) {
          console.warn('⚠️ Erreur mise à jour lastSeen:', e);
        }

        return {
          allowed: true,
          sessionId: currentSessionId,
          sessions,
          maxDevices
        };
      }
    }

    // 4. Vérifier la limite
    if (sessions.length >= maxDevices) {
      return {
        allowed: false,
        reason: 'LIMIT_REACHED',
        sessions,
        maxDevices,
        currentCount: sessions.length
      };
    }

    // 5. Créer une nouvelle session
    const newSessionId = generateSessionId();
    const deviceInfo = getDeviceInfo();

    try {
      await setDoc(
        doc(db, 'users', userId, 'activeSessions', newSessionId),
        {
          deviceInfo: deviceInfo.displayName || 'Appareil',
          deviceType: deviceInfo.type || 'unknown',
          deviceIcon: deviceInfo.icon || '💻',
          os: deviceInfo.os || 'Unknown',
          browser: deviceInfo.browser || 'Unknown',
          userAgent: deviceInfo.userAgent || '',
          isActive: true,
          createdAt: serverTimestamp(),
          lastSeen: serverTimestamp()
        }
      );

      setLocalSessionId(newSessionId);

      return {
        allowed: true,
        sessionId: newSessionId,
        sessions: [...sessions, { id: newSessionId }],
        maxDevices
      };
    } catch (e) {
      console.error('❌ Erreur création session:', e);
      return {
        allowed: false,
        reason: 'ERROR',
        error: e.message,
        maxDevices
      };
    }
  } catch (e) {
    console.error('❌ Erreur checkAndRegisterSession:', e);
    return {
      allowed: false,
      reason: 'ERROR',
      error: e.message,
      maxDevices: MAX_DEVICES_FREE
    };
  }
}

// ================================================================
// METTRE À JOUR LE HEARTBEAT
// ================================================================
export async function updateSessionHeartbeat(db, userId) {
  try {
    if (!db || !userId) return false;
    
    const sessionId = getLocalSessionId();
    if (!sessionId) return false;

    await updateDoc(
      doc(db, 'users', userId, 'activeSessions', sessionId),
      { lastSeen: serverTimestamp() }
    );
    return true;
  } catch (e) {
    console.warn('⚠️ Erreur updateSessionHeartbeat:', e);
    return false;
  }
}

// ================================================================
// DÉCONNECTER UNE SESSION SPÉCIFIQUE
// ================================================================
export async function revokeSession(db, userId, sessionId) {
  try {
    if (!db || !userId || !sessionId) return false;
    
    await deleteDoc(
      doc(db, 'users', userId, 'activeSessions', sessionId)
    );

    // Si c'est notre session actuelle, on la clear
    if (getLocalSessionId() === sessionId) {
      clearLocalSessionId();
    }

    return true;
  } catch (e) {
    console.error('❌ Erreur revokeSession:', e);
    return false;
  }
}

// ================================================================
// NETTOYER LA SESSION ACTUELLE (déconnexion)
// ================================================================
export async function unregisterCurrentSession(db, userId) {
  try {
    if (!db || !userId) return false;
    
    const sessionId = getLocalSessionId();
    if (!sessionId) return false;

    try {
      await deleteDoc(
        doc(db, 'users', userId, 'activeSessions', sessionId)
      );
    } catch (e) {
      console.warn('⚠️ Erreur suppression session:', e);
    }

    clearLocalSessionId();
    return true;
  } catch (e) {
    console.error('❌ Erreur unregisterCurrentSession:', e);
    return false;
  }
}

// ================================================================
// FORMATAGE DATE POUR AFFICHAGE
// ================================================================
export function formatLastSeen(timestamp) {
  try {
    if (!timestamp) return 'Inconnue';

    let date;
    if (typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp.seconds !== undefined) {
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      date = timestamp;
    }

    if (!date || isNaN(date.getTime())) return 'Inconnue';

    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'À l\'instant';
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;

    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    console.error('❌ Erreur formatLastSeen:', e);
    return 'Inconnue';
  }
}
