// sw.js - Service Worker pour ARVEXA School

const CACHE_NAME = 'arvexa-v1';
const STATIC_CACHE = 'arvexa-static-v1';

// Fichiers à mettre en cache
const STATIC_FILES = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/onboarding.html',
  '/profil.html',
  '/matiere.html',
  '/chapitre.html',
  '/lecture.html',
  '/sujets.html',
  '/sujet-detail.html',
  '/calculatrice.html',
  '/offline.js',
  '/manifest.json',
  '/icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap'
];

// Installation
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 Mise en cache des fichiers statiques');
        return cache.addAll(STATIC_FILES.filter(file => !!file));
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('❌ Erreur installation SW:', err))
  );
});

// Activation
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== STATIC_CACHE && name !== CACHE_NAME)
            .map(name => {
              console.log('🗑️ Suppression ancien cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
      .catch(err => console.error('❌ Erreur activation SW:', err))
  );
});

// Stratégie : Cache First, puis réseau
self.addEventListener('fetch', event => {
  try {
    const url = new URL(event.request.url);
    
    // Ignorer Firebase et les APIs externes
    if (url.origin.includes('firebase') || url.origin.includes('gstatic')) {
      event.respondWith(fetch(event.request).catch(() => new Response('Offline', { status: 503 })));
      return;
    }
    
    // Pour les pages HTML
    if (event.request.mode === 'navigate') {
      event.respondWith(
        caches.match(event.request)
          .then(response => {
            if (response) return response;
            return fetch(event.request)
              .then(response => {
                if (!response || response.status !== 200) return response;
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, responseClone);
                }).catch(err => console.warn('⚠️ Erreur cache PUT:', err));
                return response;
              })
              .catch(() => {
                // Fallback : page d'erreur hors ligne
                return caches.match('/index.html') || new Response('Offline', { status: 503 });
              });
          })
          .catch(err => {
            console.error('❌ Erreur fetch navigate:', err);
            return new Response('Offline', { status: 503 });
          })
      );
      return;
    }
    
    // Pour les autres requêtes
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) return response;
          return fetch(event.request)
            .then(response => {
              if (!response || response.status !== 200) return response;
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              }).catch(err => console.warn('⚠️ Erreur cache PUT:', err));
              return response;
            })
            .catch(() => {
              // Fallback pour les images
              if (event.request.url.match(/\.(png|jpg|jpeg|svg|gif)$/)) {
                return caches.match('/icon.png') || new Response('', { status: 404 });
              }
              return new Response('Offline', { status: 503 });
            });
        })
        .catch(err => {
          console.error('❌ Erreur fetch autres:', err);
          return new Response('Offline', { status: 503 });
        })
    );
  } catch (err) {
    console.error('❌ Erreur globale SW fetch:', err);
  }
});

console.log('✅ Service Worker chargé');
