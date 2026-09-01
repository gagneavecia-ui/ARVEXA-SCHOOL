// security-monitor.js - Détection des accès anormaux
export function monitorSecurityEvents() {
  // ✅ Détection des accès depuis un nouvel appareil
  const deviceId = localStorage.getItem('deviceId') || generateDeviceId();
  localStorage.setItem('deviceId', deviceId);
  
  // ✅ Vérifier si l'IP a changé
  if (navigator.onLine) {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => {
        const lastIP = localStorage.getItem('lastIP');
        if (lastIP && lastIP !== data.ip) {
          console.warn('⚠️ Nouvelle IP détectée:', data.ip);
          showSecurityAlert('🛡️ Nouvelle connexion détectée depuis une autre adresse IP.');
        }
        localStorage.setItem('lastIP', data.ip);
      })
      .catch(() => {});
  }
  
  // ✅ Vérifier le token toutes les 30 minutes
  setInterval(() => {
    const token = sessionStorage.getItem('firebaseToken');
    if (!token) {
      console.warn('⚠️ Token manquant, reconnexion nécessaire');
    }
  }, 30 * 60 * 1000);
}

function generateDeviceId() {
  return 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function showSecurityAlert(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    padding: 12px 20px; background: rgba(184, 134, 11, 0.15);
    backdrop-filter: blur(10px); border: 1px solid var(--accent);
    border-radius: 12px; color: var(--text-light);
    font-size: 13px; z-index: 9999; max-width: 90%;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    animation: slideUp 0.5s ease-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
`;
document.head.appendChild(style);