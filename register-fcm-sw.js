// ================================================================
// REGISTER FCM SERVICE WORKER — ARVEXA School
// ================================================================

(function() {
  'use strict';

  if (!('serviceWorker' in navigator)) {
    console.log('[FCM-SW] Service Worker non supporté');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('firebase-messaging-sw.js', {
      scope: './firebase-cloud-messaging-push-scope'
    })
    .then((registration) => {
      console.log('[FCM-SW] ✅ Service Worker FCM enregistré. Scope:', registration.scope);
    })
    .catch((error) => {
      console.error('[FCM-SW] ❌ Erreur d\'enregistrement:', error);
    });
  });
})();
