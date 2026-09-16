/* =========================================================
   firebase-messaging-sw.js
   ARVEXA School — Firebase Cloud Messaging
   ========================================================= */

importScripts(
  "https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js"
);

// =========================================================
// FIREBASE CONFIG
// =========================================================

try {
  firebase.initializeApp({
    apiKey: "AIzaSyDHscOXw3rLuhV6z1Cny-bdYCumqpnG7QE",
    authDomain: "arvexa-fbf10.firebaseapp.com",
    projectId: "arvexa-fbf10",
    storageBucket: "arvexa-fbf10.firebasestorage.app",
    messagingSenderId: "920108330053",
    appId: "1:920108330053:web:f532d71cbc2c824bc7472c"
  });
} catch (e) {
  console.error('[ARVEXA FCM] Erreur Firebase init:', e);
}

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (e) {
  console.error('[ARVEXA FCM] Erreur messaging init:', e);
}

// =========================================================
// NOTIFICATIONS EN ARRIÈRE-PLAN
// =========================================================

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    try {
      console.log(
        "[ARVEXA FCM] Notification reçue :",
        payload
      );

      const notification = payload.notification || {};
      const data = payload.data || {};

      const title =
        notification.title ||
        data.title ||
        "ARVEXA School";

      const body =
        notification.body ||
        data.body ||
        "Nouvelle notification";

      const icon =
        notification.icon ||
        data.icon ||
        "/icon.png";

      const clickAction =
        data.clickAction ||
        "/notifications.html";

      const type = data.type || "info";

      const options = {
        body: body,
        icon: icon,
        badge: "/icon.png",
        tag: `arvexa-${type}-${Date.now()}`,
        data: {
          ...data,
          clickAction: clickAction
        }
      };

      if (self.registration && self.registration.showNotification) {
        self.registration.showNotification(
          title,
          options
        );
      }
    } catch (e) {
      console.error('[ARVEXA FCM] Erreur notification:', e);
    }
  });
}

// =========================================================
// CLIC SUR UNE NOTIFICATION
// =========================================================

self.addEventListener(
  "notificationclick",
  (event) => {
    try {
      event.notification.close();

      if (event.action === "dismiss") {
        return;
      }

      const data =
        event.notification.data || {};

      const clickAction =
        data.clickAction ||
        "/notifications.html";

      let url;
      try {
        url = new URL(
          clickAction,
          self.location.origin
        ).href;
      } catch (e) {
        url = self.location.origin + clickAction;
      }

      event.waitUntil(
        self.clients
          .matchAll({
            type: "window",
            includeUncontrolled: true
          })
          .then((clients) => {
            // Chercher un client actif
            for (const client of clients) {
              if (
                client && client.url &&
                client.url.startsWith(
                  self.location.origin
                )
              ) {
                if ("navigate" in client && client.navigate) {
                  return client.navigate(url);
                }

                if ("focus" in client && client.focus) {
                  return client.focus();
                }
              }
            }

            // Ouvrir nouvelle fenêtre
            if (self.clients.openWindow) {
              return self.clients.openWindow(url);
            }
          })
          .catch(err => console.error('[ARVEXA FCM] Erreur notificationclick:', err))
      );
    } catch (e) {
      console.error('[ARVEXA FCM] Erreur handler notification:', e);
    }
  }
);

console.log(
  "[ARVEXA FCM] Service Worker chargé."
);
