// ============================================================================
// Firebase SDK Initializer & Unified Service Layer (Production)
// ============================================================================

import { initializeApp, getApps } from 'firebase/app';
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
// Default Test Configurations & Initial Seed Definitions
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

const LOCAL_USERS = {
  'adminbkt@bkt.com': {
    uid: 'local_adminbkt_uid',
    username: 'adminbkt',
    email: 'adminbkt@bkt.com',
    name: 'ผู้ดูแลระบบส่วนกลาง (BKT Super Admin)',
    code: 'ADMIN-HQ',
    department: 'ศูนย์บริหารจัดการข้อมูลการทดสอบกลาง',
    contact: 'ผู้ควบคุมระบบส่วนกลาง',
    role: 'admin'
  },
  'test1@bkt.com': {
    uid: 'local_test1_uid',
    username: 'test1',
    email: 'test1@bkt.com',
    name: 'ศูนย์ทดสอบสาขา 1 (หน่วยงานที่ 1)',
    code: 'LAB-001',
    department: 'แผนกเคมีคลินิกและโลหิตวิทยา',
    contact: 'คุณประสิทธิ์ รักษ์การแพทย์',
    role: 'user'
  },
  'test2@bkt.com': {
    uid: 'local_test2_uid',
    username: 'test2',
    email: 'test2@bkt.com',
    name: 'ศูนย์ทดสอบสาขา 2 (หน่วยงานที่ 2)',
    code: 'LAB-002',
    department: 'แผนกจุลชีววิทยาและภูมิคุ้มกันวิทยา',
    contact: 'คุณศิริพร สุขสวัสดิ์',
    role: 'user'
  }
};

const DEFAULT_LOCAL_SUBMISSIONS = {
  'test1_2026_0': {
    userId: 'local_test1_uid',
    username: 'test1',
    year: 2026,
    monthIndex: 0,
    results: {
      'test_a': 'Negative (-)',
      'test_b': '95.4',
      'test_c': 'ผ่านเกณฑ์มาตรฐานปกติ ไม่มีสิ่งผิดปกติ'
    },
    remarks: 'ส่งผลตรงตามกำหนดเวลา รอบ ม.ค. 2569',
    submittedAt: '2026-01-25 10:30'
  },
  'test1_2026_1': {
    userId: 'local_test1_uid',
    username: 'test1',
    year: 2026,
    monthIndex: 1,
    results: {
      'test_a': 'Negative (-)',
      'test_b': '102.1',
      'test_c': 'การควบคุมคุณภาพอยู่ในเกณฑ์ 2SD'
    },
    remarks: 'สอบเทียบเครื่องมือประจำเดือนเรียบร้อย',
    submittedAt: '2026-02-24 14:15'
  },
  'test2_2026_0': {
    userId: 'local_test2_uid',
    username: 'test2',
    year: 2026,
    monthIndex: 0,
    results: {
      'test_a': 'Negative (-)',
      'test_b': '88.2',
      'test_c': 'ระดับความเข้มข้นสม่ำเสมอ'
    },
    remarks: '',
    submittedAt: '2026-01-28 09:40'
  }
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

  // Check if superadmin
  const isSuperAdmin = (email === 'adminbkt@bkt.com' || email === 'admin@bkt.com' || username === 'adminbkt');

  if (isFirebaseConfigured && auth && db) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);

      let userData;
      if (userDoc.exists()) {
        userData = { uid, ...userDoc.data() };
        // Ensure superadmin has admin role
        if (isSuperAdmin && userData.role !== 'admin') {
          userData.role = 'admin';
          await setDoc(userDocRef, { role: 'admin' }, { merge: true });
        }
      } else {
        // Auto-create initial profile for the authenticated user
        userData = {
          uid,
          email,
          username,
          name: isSuperAdmin ? 'ผู้ดูแลระบบส่วนกลาง (BKT Admin)' : `หน่วยงาน ${username.toUpperCase()}`,
          code: isSuperAdmin ? 'ADMIN-HQ' : `LAB-${username.toUpperCase()}`,
          department: isSuperAdmin ? 'ศูนย์บริหารจัดการข้อมูลกลาง' : 'ห้องปฏิบัติการมาตรฐาน',
          contact: 'เจ้าหน้าที่ผู้รับผิดชอบ',
          role: isSuperAdmin ? 'admin' : 'user',
          createdAt: new Date().toISOString()
        };
        try {
          await setDoc(userDocRef, userData);
        } catch (err) {
          console.warn('[Firestore] Could not auto-create user doc:', err);
        }
      }

      localStorage.setItem('portal_current_user', JSON.stringify(userData));
      return userData;
    } catch (firebaseErr) {
      console.warn('[Firebase Auth Error]:', firebaseErr.code, firebaseErr.message);

      // Check fallback credentials
      if (isSuperAdmin && password === 'adminbkt') {
        const adminObj = LOCAL_USERS['adminbkt@bkt.com'];
        localStorage.setItem('portal_current_user', JSON.stringify(adminObj));
        return adminObj;
      }
      if (LOCAL_USERS[email] && password === username) {
        localStorage.setItem('portal_current_user', JSON.stringify(LOCAL_USERS[email]));
        return LOCAL_USERS[email];
      }

      if (firebaseErr.code === 'auth/invalid-credential' || firebaseErr.code === 'auth/user-not-found' || firebaseErr.code === 'auth/wrong-password') {
        throw new Error('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      }
      throw new Error(`การเข้าสู่ระบบขัดข้อง: ${firebaseErr.message}`);
    }
  } else {
    // Local / Standalone Demo Mode
    if (isSuperAdmin && (password === 'adminbkt' || password === 'admin')) {
      const adminObj = LOCAL_USERS['adminbkt@bkt.com'];
      localStorage.setItem('portal_current_user', JSON.stringify(adminObj));
      return adminObj;
    }

    if (LOCAL_USERS[email] && (password === username || password === '123456')) {
      localStorage.setItem('portal_current_user', JSON.stringify(LOCAL_USERS[email]));
      return LOCAL_USERS[email];
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
            name: isSuperAdmin ? 'ผู้ดูแลระบบส่วนกลาง (BKT Admin)' : (email.split('@')[0] || 'User'),
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
// User Management API (Admin Tab 3)
// ============================================================================

/**
 * Fetch all users list
 */
export async function apiGetUsers() {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list = [];
      snap.forEach(d => list.push({ uid: d.id, ...d.data() }));
      if (list.length > 0) return list;
    } catch (e) {
      console.warn('Firestore users fetch failed, using fallback:', e);
    }
  }

  // Local fallback
  const raw = localStorage.getItem('portal_all_users');
  if (!raw) {
    const list = Object.values(LOCAL_USERS);
    localStorage.setItem('portal_all_users', JSON.stringify(list));
    return list;
  }
  return JSON.parse(raw);
}

/**
 * Create a new user by Admin (Uses Secondary Firebase App instance to keep Admin session intact)
 */
export async function apiCreateUserByAdmin({ email, password, name, code, department, contact, role }) {
  const normEmail = normalizeUserEmail(email);
  const username = normEmail.split('@')[0];

  if (isFirebaseConfigured && db) {
    // Create Secondary App instance
    const secondaryAppName = `SecondaryApp_${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, normEmail, password);
      const newUid = cred.user.uid;

      const newUserDoc = {
        uid: newUid,
        email: normEmail,
        username,
        name: name || `ศูนย์ทดสอบ ${username}`,
        code: code || `LAB-${username.toUpperCase()}`,
        department: department || 'แผนกห้องปฏิบัติการ',
        contact: contact || '-',
        role: role || 'user',
        createdAt: new Date().toISOString()
      };

      // Save to main Firestore
      await setDoc(doc(db, 'users', newUid), newUserDoc);

      // Sign out from secondary auth
      await signOut(secondaryAuth);

      return newUserDoc;
    } catch (err) {
      await signOut(secondaryAuth).catch(() => {});
      if (err.code === 'auth/email-already-in-use') {
        throw new Error(`อีเมล ${normEmail} มีอยู่ในระบบแล้ว`);
      }
      if (err.code === 'auth/weak-password') {
        throw new Error('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      }
      throw new Error(`ไม่สามารถสร้างผู้ใช้งานได้: ${err.message}`);
    }
  } else {
    // Local fallback
    const list = await apiGetUsers();
    if (list.some(u => u.email.toLowerCase() === normEmail.toLowerCase())) {
      throw new Error(`อีเมล ${normEmail} มีอยู่ในระบบแล้ว`);
    }
    const newUser = {
      uid: `local_${Date.now()}`,
      email: normEmail,
      username,
      name: name || `ศูนย์ทดสอบ ${username}`,
      code: code || `LAB-${username.toUpperCase()}`,
      department: department || 'แผนกห้องปฏิบัติการ',
      contact: contact || '-',
      role: role || 'user',
      createdAt: new Date().toISOString()
    };
    list.push(newUser);
    localStorage.setItem('portal_all_users', JSON.stringify(list));
    LOCAL_USERS[normEmail] = newUser;
    return newUser;
  }
}

/**
 * Update user role or profile
 */
export async function apiUpdateUser(uid, updates) {
  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, 'users', uid), updates);
    return;
  }

  // Local fallback
  const list = await apiGetUsers();
  const idx = list.findIndex(u => u.uid === uid);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates };
    localStorage.setItem('portal_all_users', JSON.stringify(list));
  }
}

/**
 * Delete a user
 */
export async function apiDeleteUser(uid) {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, 'users', uid));
    return;
  }

  // Local fallback
  const list = await apiGetUsers();
  const filtered = list.filter(u => u.uid !== uid);
  localStorage.setItem('portal_all_users', JSON.stringify(filtered));
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
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'test_configs', config.id);
    await setDoc(docRef, config, { merge: true });
    return;
  }

  const list = await apiGetTestConfigs();
  const idx = list.findIndex(t => t.id === config.id);
  if (idx >= 0) {
    list[idx] = config;
  } else {
    list.push(config);
  }
  localStorage.setItem('portal_test_configs', JSON.stringify(list));
}

export async function apiDeleteTestConfig(testId) {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, 'test_configs', testId));
    return;
  }

  const list = await apiGetTestConfigs();
  const filtered = list.filter(t => t.id !== testId);
  localStorage.setItem('portal_test_configs', JSON.stringify(filtered));
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
  if (!raw) {
    localStorage.setItem('portal_submissions', JSON.stringify(DEFAULT_LOCAL_SUBMISSIONS));
    return DEFAULT_LOCAL_SUBMISSIONS;
  }
  return JSON.parse(raw);
}

export async function apiSaveSubmission(submissionKey, submissionData) {
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'submissions', submissionKey);
    await setDoc(docRef, submissionData, { merge: true });
    return;
  }

  const submissions = await apiGetSubmissions();
  submissions[submissionKey] = submissionData;
  localStorage.setItem('portal_submissions', JSON.stringify(submissions));
}

export async function apiDeleteSubmission(submissionKey) {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, 'submissions', submissionKey));
    return;
  }

  const submissions = await apiGetSubmissions();
  delete submissions[submissionKey];
  localStorage.setItem('portal_submissions', JSON.stringify(submissions));
}
