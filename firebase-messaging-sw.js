// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js');

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

// ✅ Utiliser self.Notification au lieu de Notification directement
if (typeof self.Notification !== 'undefined') {
  console.log('🔔 Notifications supportées dans ce navigateur');
}

messaging.onBackgroundMessage((payload) => {
  console.log('📩 Message FCM en arrière-plan:', payload);

  // Extraire les données
  const { title, body, icon, link, type } = payload.data || {};
  const notificationTitle = title || 'ARVEXA School';
  const notificationBody = body || 'Nouvelle notification disponible.';
  const notificationIcon = icon || '/icon.png';

  // ✅ Utiliser self.registration.showNotification
  self.registration.showNotification(notificationTitle, {
    body: notificationBody,
    icon: notificationIcon,
    badge: notificationIcon,
    data: {
      link: link || '/',
      type: type || 'info'
    },
    vibrate: [200, 100, 200],
    requireInteraction: true
  });
});

// ✅ Gestion du clic sur la notification
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Clic sur notification:', event.notification);
  event.notification.close();

  const link = event.notification.data?.link || '/';
  const type = event.notification.data?.type || 'info';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Si une fenêtre est déjà ouverte, on la focalise
      for (const client of clientList) {
        if (client.url.includes(link) && 'focus' in client) {
          return client.focus();
        }
        // Si la page d'accueil est ouverte, on la focalise
        if (client.url.includes('index.html') && 'focus' in client) {
          client.postMessage({
            type: 'notification_click',
            data: event.notification.data
          });
          return client.focus();
        }
      }
      // Sinon on ouvre une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(link);
      }
    })
  );
});

// ✅ Gestion de la fermeture de la notification
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notification fermée:', event.notification);
});

// ✅ Vérification du support
console.log('🔔 Service Worker FCM prêt');