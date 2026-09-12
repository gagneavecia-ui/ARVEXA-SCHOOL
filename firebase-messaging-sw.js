/* =========================================================
   firebase-messaging-sw.js
   Service Worker pour Firebase Cloud Messaging — ARVEXa School
   Gère les notifications push quand l'app est en arrière-plan
   ========================================================= */

importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging.js");

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDHscOXw3rLuhV6z1Cny-bdYCumqpnG7QE",
  authDomain: "arvexa-fbf10.firebaseapp.com",
  projectId: "arvexa-fbf10",
  storageBucket: "arvexa-fbf10.firebasestorage.app",
  messagingSenderId: "920108330053",
  appId: "1:920108330053:web:f532d71cbc2c824bc7472c"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// =========================================================
// Background message handler
// Quand l'app n'est pas au premier plan, ce handler affiche
// la notification dans la barre de notifications du navigateur
// =========================================================
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Message reçu en arrière-plan:', payload);

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || 'ARVEXa School';
  const body = notification.body || data.body || 'Nouvelle notification';
  const icon = notification.icon || data.icon || '/icon.png';
  const badge = '/icon.png';

  // Type-based styling
  const type = data.type || 'info';
  const tag = `arvexa-${type}-${Date.now()}`;

  const options = {
    body: body,
    icon: icon,
    badge: badge,
    tag: tag,
    data: {
      ...data,
      clickAction: data.clickAction || '/',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' }
    ],
    requireInteraction: type === 'warning' || type === 'danger',
    silent: false,
    vibrate: type === 'danger' ? [200, 100, 200, 100, 200] : [100, 50, 100]
  };

  self.registration.showNotification(title, options);
});

// =========================================================
// Notification click handler
// Quand l'utilisateur clique sur la notification, on ouvre
// ou on focus l'app sur la page notifications
// =========================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  if (action === 'dismiss') return;

  const clickAction = event.notification.data?.clickAction || '/notifications.html';
  const url = new URL(clickAction, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});

// =========================================================
// Push subscription change handler
// Quand le navigateur renouvelle le token d'abonnement
// =========================================================
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[firebase-messaging-sw.js] Push subscription changed');
  // The FCM SDK handles re-subscription automatically
});
