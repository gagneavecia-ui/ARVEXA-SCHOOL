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

firebase.initializeApp({
  apiKey: "AIzaSyDHscOXw3rLuhV6z1Cny-bdYCumqpnG7QE",
  authDomain: "arvexa-fbf10.firebaseapp.com",
  projectId: "arvexa-fbf10",
  storageBucket: "arvexa-fbf10.firebasestorage.app",
  messagingSenderId: "920108330053",
  appId: "1:920108330053:web:f532d71cbc2c824bc7472c"
});

const messaging = firebase.messaging();

// =========================================================
// NOTIFICATIONS EN ARRIÈRE-PLAN
// =========================================================

messaging.onBackgroundMessage((payload) => {

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

  self.registration.showNotification(
    title,
    options
  );
});

// =========================================================
// CLIC SUR UNE NOTIFICATION
// =========================================================

self.addEventListener(
  "notificationclick",
  (event) => {

    event.notification.close();

    if (event.action === "dismiss") {
      return;
    }

    const data =
      event.notification.data || {};

    const clickAction =
      data.clickAction ||
      "/notifications.html";

    const url =
      new URL(
        clickAction,
        self.location.origin
      ).href;

    event.waitUntil(

      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true
        })
        .then((clients) => {

          for (const client of clients) {

            if (
              client.url.startsWith(
                self.location.origin
              )
            ) {

              if ("navigate" in client) {
                client.navigate(url);
              }

              if ("focus" in client) {
                return client.focus();
              }
            }
          }

          if (self.clients.openWindow) {
            return self.clients.openWindow(url);
          }

        })

    );
  }
);

console.log(
  "[ARVEXA FCM] Service Worker chargé."
);
