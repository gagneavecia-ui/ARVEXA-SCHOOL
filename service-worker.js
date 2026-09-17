// ================================================================
// SERVICE WORKER — ARVEXA School
// Version : 1.0.0
// ================================================================

const CACHE_VERSION = 'arvexa-v1.0.0';
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;

// Fichiers essentiels à mettre en cache dès l'installation
const ESSENTIAL_FILES = [
  './',
  './index.html',
  './login.html',
  './register.html',
  './onboarding.html',
  './matiere.html',
  './chapitre.html',
  './lecture.html',
  './abonnement.html',
  './profil.html',
  './formulaires.html',
  './calculatrice.html',
  './offline.html',
  './manifest.json',
  './icon.png',
  './register-sw.js'
];

// ================================================================
// INSTALLATION
// ================================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');

  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(ESSENTIAL_FILES).catch((err) => {
        console.warn('[SW] Certains fichiers n\'ont pas pu être mis en cache:', err);
      });
    }).then(() => {
      // Prendre le contrôle immédiatement
      return self.skipWaiting();
    })
  );
});

// ================================================================
// ACTIVATION
// ================================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Supprimer les anciens caches
          if (cacheName !== CACHE_STATIC && cacheName !== CACHE_DYNAMIC) {
            console.log('[SW] Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Prendre le contrôle des clients ouverts
      return self.clients.claim();
    })
  );
});

// ================================================================
// FETCH — INTERCEPTION DES REQUÊTES
// ================================================================
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ne pas intercepter les requêtes non-GET
  if (request.method !== 'GET') return;

  // Ne pas intercepter les requêtes Firebase (Firestore, Auth)
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    // Pour Firebase Auth et Firestore, on utilise network-first
    if (url.pathname.includes('/v1/') || url.pathname.includes('firestore')) {
      return;
    }
  }

  // Ne pas intercepter les scripts analytics ou autres services externes
  if (url.hostname !== location.hostname &&
      !url.hostname.includes('cdnjs.cloudflare.com') &&
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('fonts.gstatic.com') &&
      !url.hostname.includes('cdn.jsdelivr.net') &&
      !url.hostname.includes('gstatic.com')) {
    return;
  }

  // Stratégie selon le type de ressource
  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    // HTML : Network-first avec fallback cache
    event.respondWith(networkFirstWithCache(request, CACHE_DYNAMIC));
  } else if (url.pathname.endsWith('.json')) {
    // JSON : Network-first avec fallback cache
    event.respondWith(networkFirstWithCache(request, CACHE_DYNAMIC));
  } else if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    // JS/CSS : Cache-first (moins de changement)
    event.respondWith(cacheFirstWithNetwork(request, CACHE_STATIC));
  } else if (request.destination === 'image' || url.pathname.endsWith('.png') ||
             url.pathname.endsWith('.jpg') || url.pathname.endsWith('.svg') ||
             url.pathname.endsWith('.webp')) {
    // Images : Cache-first
    event.respondWith(cacheFirstWithNetwork(request, CACHE_DYNAMIC));
  } else if (url.hostname.includes('cdnjs.cloudflare.com') ||
             url.hostname.includes('fonts.googleapis.com') ||
             url.hostname.includes('fonts.gstatic.com') ||
             url.hostname.includes('cdn.jsdelivr.net')) {
    // Ressources externes (CDN, fonts) : Cache-first
    event.respondWith(cacheFirstWithNetwork(request, CACHE_STATIC));
  } else {
    // Par défaut : Network-first
    event.respondWith(networkFirstWithCache(request, CACHE_DYNAMIC));
  }
});

// ================================================================
// STRATÉGIES DE CACHE
// ================================================================

// Cache-first : Utilise le cache, sinon fetch et met en cache
async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    // Mettre à jour en arrière-plan
    fetch(request).then((response) => {
      if (response && response.ok) {
        caches.open(cacheName).then((cache) => {
          cache.put(request, response.clone());
        });
      }
    }).catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Si on est hors-ligne, essayer offline.html pour les documents
    if (request.destination === 'document') {
      const offline = await caches.match('./offline.html');
      if (offline) return offline;
    }
    throw error;
  }
}

// Network-first : Essaye le réseau, fallback cache
async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);

    // Mettre en cache si valide
    if (response && response.ok && response.type === 'basic') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Réseau échoué → chercher dans le cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Si c'est un document et rien en cache → offline.html
    if (request.destination === 'document') {
      const offline = await caches.match('./offline.html');
      if (offline) return offline;
    }

    throw error;
  }
}

// ================================================================
// MESSAGES (depuis les pages)
// ================================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

console.log('[SW] Service Worker chargé. Version:', CACHE_VERSION);