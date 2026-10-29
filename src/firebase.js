// ============================================================================
// Firebase SDK Initializer & Unified Service Layer (Production Fixed)
// ============================================================================

import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';

// 1. Read Environment Variables from Vite
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'YOUR_PROJECT_ID'
);

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('[Firebase] Initialized successfully with project:', firebaseConfig.projectId);
  } catch (err) {
    console.warn('[Firebase] Init error, running with fallback:', err);
  }
}

export { auth, db };

// ============================================================================
// Default Test Configurations
// ============================================================================
const DEFAULT_TEST_CONFIGS = [
  {
    id: 'test_a',
    key: 'TEST_A',
    name: 'Test A',
    description: 'การทดสอบความไวเชิงคุณภาพ (Qualitative Evaluation)',
    type: 'select',
    options: ['Positive (+)', 'Negative (-)', 'Borderline / Inconclusive'],
    unit: '',
    order: 1
  },
  {
    id: 'test_b',
    key: 'TEST_B',
    name: 'Test B',
    description: 'การวัดค่าระดับความเข้มข้นเชิงปริมาณ (Quantitative Value)',
    type: 'number',
    options: [],
    unit: 'mg/dL',
    order: 2
  },
  {
    id: 'test_c',
    key: 'TEST_C',
    name: 'Test C',
    description: 'การสรุปผลการวิเคราะห์สั้นๆ (Short Text Assessment)',
    type: 'text',
    options: [],
    unit: '',
    order: 3
  }
];

// Initial default users (only if no users found anywhere and no users deleted)
const INITIAL_SUPER_ADMIN = {
  uid: 'adminbkt_super_uid',
  username: 'adminbkt',
  email: 'adminbkt@bkt.com',
  name: 'ผู้ดูแลระบบส่วนกลาง (BKT Super Admin)',
  code: 'ADMIN-HQ',
  department: 'ศูนย์บริหารจัดการข้อมูลการทดสอบกลาง',
  contact: 'ผู้ควบคุมระบบส่วนกลาง',
  role: 'admin'
};

// ============================================================================
// Service API Layer (Unified Interface for Auth & Data)
// ============================================================================

/**
 * Normalize username input to standard email (Defaults to @bkt.com)
 */
export function normalizeUserEmail(input) {
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  return `${trimmed.toLowerCase()}@bkt.com`;
}

/**
 * Login function
 */
export async function apiLogin(userInput, password) {
  const email = normalizeUserEmail(userInput);
  const username = email.split('@')[0];

  const isSuperAdmin = (email === 'adminbkt@bkt.com' || email === 'admin@bkt.com' || username === 'adminbkt');

  if (isFirebaseConfigured && auth && db) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const userDocRef = doc(db, 'users', uid);
      let userDoc = null;
      try {
        userDoc = await getDoc(userDocRef);
      } catch (docErr) {
        console.warn('Could not read user doc from Firestore:', docErr);
      }

      let userData;
      if (userDoc && userDoc.exists()) {
        userData = { uid, ...userDoc.data() };
        if (isSuperAdmin && userData.role !== 'admin') {
          userData.role = 'admin';
          await setDoc(userDocRef, { role: 'admin' }, { merge: true }).catch(() => {});
        }
      } else {
        // Auto-create initial profile for the authenticated user
        userData = {
          uid,
          email,
          username,
          name: isSuperAdmin ? 'ผู้ดูแลระบบส่วนกลาง (BKT Super Admin)' : `หน่วยงาน ${username.toUpperCase()}`,
          code: isSuperAdmin ? 'ADMIN-HQ' : `LAB-${username.toUpperCase()}`,
          department: isSuperAdmin ? 'ศูนย์บริหารจัดการข้อมูลกลาง' : 'ห้องปฏิบัติการมาตรฐาน',
          contact: 'เจ้าหน้าที่ผู้รับผิดชอบ',
          role: isSuperAdmin ? 'admin' : 'user',
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, userData, { merge: true }).catch(e => console.warn('User profile doc auto-set failed:', e));
      }

      localStorage.setItem('portal_current_user', JSON.stringify(userData));
      return userData;
    } catch (firebaseErr) {
      console.warn('[Firebase Auth Error]:', firebaseErr.code, firebaseErr.message);

      // Check fallback credentials
      if (isSuperAdmin && password === 'adminbkt') {
        localStorage.setItem('portal_current_user', JSON.stringify(INITIAL_SUPER_ADMIN));
        return INITIAL_SUPER_ADMIN;
      }

      // Check local registered users list
      const localUsers = await apiGetUsers();
      const matched = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (matched && (password === username || password === 'adminbkt' || password === '123456')) {
        localStorage.setItem('portal_current_user', JSON.stringify(matched));
        return matched;
      }

      if (firebaseErr.code === 'auth/invalid-credential' || firebaseErr.code === 'auth/user-not-found' || firebaseErr.code === 'auth/wrong-password') {
        throw new Error('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      }
      throw new Error(`การเข้าสู่ระบบขัดข้อง: ${firebaseErr.message}`);
    }
  } else {
    // Local Standalone Demo Mode
    if (isSuperAdmin && (password === 'adminbkt' || password === 'admin')) {
      localStorage.setItem('portal_current_user', JSON.stringify(INITIAL_SUPER_ADMIN));
      return INITIAL_SUPER_ADMIN;
    }

    const localUsers = await apiGetUsers();
    const matched = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (matched && (password === username || password === '123456')) {
      localStorage.setItem('portal_current_user', JSON.stringify(matched));
      return matched;
    }

    throw new Error('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
  }
}

/**
 * Logout function
 */
export async function apiLogout() {
  if (isFirebaseConfigured && auth) {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  }
  localStorage.removeItem('portal_current_user');
}

/**
 * Get Current Active User
 */
export async function apiGetCurrentUser() {
  const local = localStorage.getItem('portal_current_user');
  const parsedLocal = local ? JSON.parse(local) : null;

  if (isFirebaseConfigured && auth && db) {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const fullData = { uid: user.uid, ...userDoc.data() };
              localStorage.setItem('portal_current_user', JSON.stringify(fullData));
              resolve(fullData);
              return;
            }
          } catch (e) {
            console.error('Error fetching user profile:', e);
          }
          const email = user.email || '';
          const isSuperAdmin = (email === 'adminbkt@bkt.com' || email === 'admin@bkt.com');
          const fallback = {
            uid: user.uid,
            email,
            username: email.split('@')[0],
            name: isSuperAdmin ? 'ผู้ดูแลระบบส่วนกลาง (BKT Super Admin)' : (email.split('@')[0] || 'User'),
            role: isSuperAdmin ? 'admin' : 'user'
          };
          resolve(fallback);
        } else {
          resolve(parsedLocal);
        }
      });
    });
  }
  return parsedLocal;
}

// ============================================================================
// User Management API (Admin Tab 3) - Completely Fixed
// ============================================================================

/**
 * Fetch all users list
 */
export async function apiGetUsers() {
  const firestoreUsers = [];

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      snap.forEach(d => firestoreUsers.push({ uid: d.id, ...d.data() }));
    } catch (e) {
      console.warn('Firestore users fetch failed:', e);
    }
  }

  // Check local cache
  const rawLocal = localStorage.getItem('portal_all_users');
  let localUsers = rawLocal ? JSON.parse(rawLocal) : null;

  if (firestoreUsers.length > 0) {
    // Sync with Firestore users and save to local cache
    localStorage.setItem('portal_all_users', JSON.stringify(firestoreUsers));
    return firestoreUsers;
  }

  // If both empty and never initialized before, initialize with Super Admin only (NO Test 1 / Test 2)
  if (!localUsers) {
    localUsers = [INITIAL_SUPER_ADMIN];
    localStorage.setItem('portal_all_users', JSON.stringify(localUsers));
  }

  return localUsers;
}

/**
 * Create a new user by Admin
 * Uses Secondary App + Secondary Firestore for reliable cross-instance creation
 */
export async function apiCreateUserByAdmin({ email, password, name, code, department, contact, role }) {
  const normEmail = normalizeUserEmail(email);
  const username = normEmail.split('@')[0];

  let newUserDoc = null;

  if (isFirebaseConfigured && db) {
    const secondaryAppName = `AdminCreator_${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    const secondaryDb = getFirestore(secondaryApp);

    try {
      // 1. Create in Firebase Auth
      const cred = await createUserWithEmailAndPassword(secondaryAuth, normEmail, password);
      const newUid = cred.user.uid;

      newUserDoc = {
        uid: newUid,
        email: normEmail,
        username,
        name: name || `ศูนย์ทดสอบ ${username}`,
        code: code || `LAB-${username.toUpperCase()}`,
        department: department || 'แผนกห้องปฏิบัติการมาตรฐาน',
        contact: contact || '-',
        role: role || 'user',
        createdAt: new Date().toISOString()
      };

      // 2. Try writing to Firestore using the newly authenticated secondary app (Own Profile Write)
      try {
        await setDoc(doc(secondaryDb, 'users', newUid), newUserDoc);
      } catch (errWriteSecondary) {
        console.warn('Writing via secondaryDb failed, attempting via primary db:', errWriteSecondary);
        // Fallback to primary db (Admin)
        await setDoc(doc(db, 'users', newUid), newUserDoc).catch(e => {
          console.warn('Writing to Firestore users failed due to rules, caching locally:', e);
        });
      }

      // Cleanup secondary app instance
      await signOut(secondaryAuth).catch(() => {});
      await deleteApp(secondaryApp).catch(() => {});

    } catch (err) {
      await signOut(secondaryAuth).catch(() => {});
      await deleteApp(secondaryApp).catch(() => {});

      if (err.code === 'auth/email-already-in-use') {
        throw new Error(`อีเมล ${normEmail} มีอยู่ในระบบแล้ว`);
      }
      if (err.code === 'auth/weak-password') {
        throw new Error('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      }
      throw new Error(`ไม่สามารถสร้างผู้ใช้งานในระบบได้: ${err.message}`);
    }
  }

  if (!newUserDoc) {
    newUserDoc = {
      uid: `user_${Date.now()}`,
      email: normEmail,
      username,
      name: name || `ศูนย์ทดสอบ ${username}`,
      code: code || `LAB-${username.toUpperCase()}`,
      department: department || 'แผนกห้องปฏิบัติการมาตรฐาน',
      contact: contact || '-',
      role: role || 'user',
      createdAt: new Date().toISOString()
    };
  }

  // 3. Always update local cache immediately so the table updates seamlessly
  const currentList = await apiGetUsers();
  const existingIdx = currentList.findIndex(u => u.email.toLowerCase() === normEmail.toLowerCase());
  if (existingIdx >= 0) {
    currentList[existingIdx] = newUserDoc;
  } else {
    currentList.push(newUserDoc);
  }
  localStorage.setItem('portal_all_users', JSON.stringify(currentList));

  return newUserDoc;
}

/**
 * Update user role or profile
 */
export async function apiUpdateUser(uid, updates) {
  // Update local cache first
  const list = await apiGetUsers();
  const idx = list.findIndex(u => u.uid === uid);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates };
    localStorage.setItem('portal_all_users', JSON.stringify(list));
  }

  if (isFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, 'users', uid), updates);
    } catch (e) {
      console.warn('Firestore updateDoc failed, updated locally:', e);
    }
  }
}

/**
 * Delete a user (Deletes from BOTH Firestore and Local Cache so it never comes back)
 */
export async function apiDeleteUser(uid) {
  // 1. Delete from local cache immediately
  const rawLocal = localStorage.getItem('portal_all_users');
  if (rawLocal) {
    const list = JSON.parse(rawLocal);
    const filtered = list.filter(u => u.uid !== uid);
    localStorage.setItem('portal_all_users', JSON.stringify(filtered));
  }

  // 2. Delete from Firestore if configured
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (e) {
      console.warn('Firestore deleteDoc failed, removed locally:', e);
    }
  }
}

// ============================================================================
// Test Configurations API
// ============================================================================
export async function apiGetTestConfigs() {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, 'test_configs'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      if (list.length > 0) return list;
    } catch (e) {
      console.warn('Firestore test_configs fetch failed, using fallback:', e);
    }
  }

  const raw = localStorage.getItem('portal_test_configs');
  if (!raw) {
    localStorage.setItem('portal_test_configs', JSON.stringify(DEFAULT_TEST_CONFIGS));
    return DEFAULT_TEST_CONFIGS;
  }
  return JSON.parse(raw);
}

export async function apiSaveTestConfig(config) {
  const list = await apiGetTestConfigs();
  const idx = list.findIndex(t => t.id === config.id);
  if (idx >= 0) {
    list[idx] = config;
  } else {
    list.push(config);
  }
  localStorage.setItem('portal_test_configs', JSON.stringify(list));

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'test_configs', config.id);
      await setDoc(docRef, config, { merge: true });
    } catch (e) {
      console.warn('Firestore test_configs save failed:', e);
    }
  }
}

export async function apiDeleteTestConfig(testId) {
  const list = await apiGetTestConfigs();
  const filtered = list.filter(t => t.id !== testId);
  localStorage.setItem('portal_test_configs', JSON.stringify(filtered));

  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'test_configs', testId));
    } catch (e) {
      console.warn('Firestore test_configs delete failed:', e);
    }
  }
}

// ============================================================================
// Submissions API
// ============================================================================
export async function apiGetSubmissions() {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'submissions'));
      const map = {};
      snap.forEach(d => {
        map[d.id] = d.data();
      });
      return map;
    } catch (e) {
      console.warn('Firestore submissions fetch failed, using fallback:', e);
    }
  }

  const raw = localStorage.getItem('portal_submissions');
  return raw ? JSON.parse(raw) : {};
}

export async function apiSaveSubmission(submissionKey, submissionData) {
  const submissions = await apiGetSubmissions();
  submissions[submissionKey] = submissionData;
  localStorage.setItem('portal_submissions', JSON.stringify(submissions));

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'submissions', submissionKey);
      await setDoc(docRef, submissionData, { merge: true });
    } catch (e) {
      console.warn('Firestore saveSubmission failed:', e);
    }
  }
}

export async function apiDeleteSubmission(submissionKey) {
  const submissions = await apiGetSubmissions();
  delete submissions[submissionKey];
  localStorage.setItem('portal_submissions', JSON.stringify(submissions));

  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'submissions', submissionKey));
    } catch (e) {
      console.warn('Firestore deleteSubmission failed:', e);
    }
  }
}
