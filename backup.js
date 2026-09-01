// backup.js - Sauvegarde automatique
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

export async function backupUserData() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;
  
  const db = getFirestore();
  
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const progressDoc = await getDoc(doc(db, 'users', user.uid, 'progress', 'overall'));
    
    const backup = {
      timestamp: Date.now(),
      user: userDoc.data(),
      progress: progressDoc.exists() ? progressDoc.data() : null
    };
    
    localStorage.setItem(`backup_${user.uid}`, JSON.stringify(backup));
    console.log('✅ Sauvegarde effectuée');
  } catch (error) {
    console.error('❌ Erreur de sauvegarde:', error);
  }
}

// Sauvegarde automatique toutes les 30 minutes
setInterval(backupUserData, 30 * 60 * 1000);

// Sauvegarde au chargement
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(backupUserData, 5000);
});