// ============================================================================
// Firebase SDK Initializer & Service Layer
// รองรับทั้ง Real Firebase Mode และ Local Fallback Mode (เมื่อยังไม่ได้ใส่ Key)
// ============================================================================

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
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
  where, 
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
    console.log('[Firebase] Initialized with project:', firebaseConfig.projectId);
  } catch (err) {
    console.warn('[Firebase] Initialization error, falling back to local storage:', err);
  }
} else {
  console.log('[Firebase] No valid credentials found in .env, running in Standalone/Demo mode');
}

export { auth, db };

// ============================================================================
// Internal Mock & Default Seed Data
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
  'Test1': {
    uid: 'local_test1_uid',
    username: 'Test1',
    email: 'test1@portal.local',
    name: 'ศูนย์ทดสอบสาขา 1 (หน่วยงานที่ 1)',
    code: 'LAB-001',
    department: 'แผนกเคมีคลินิกและโลหิตวิทยา',
    contact: 'คุณประสิทธิ์ รักษ์การแพทย์',
    role: 'user'
  },
  'Test2': {
    uid: 'local_test2_uid',
    username: 'Test2',
    email: 'test2@portal.local',
    name: 'ศูนย์ทดสอบสาขา 2 (หน่วยงานที่ 2)',
    code: 'LAB-002',
    department: 'แผนกจุลชีววิทยาและภูมิคุ้มกันวิทยา',
    contact: 'คุณศิริพร สุขสวัสดิ์',
    role: 'user'
  },
  'admin': {
    uid: 'local_admin_uid',
    username: 'admin',
    email: 'admin@portal.local',
    name: 'ผู้ดูแลระบบส่วนกลาง (Admin)',
    code: 'ADMIN-HQ',
    department: 'ศูนย์บริหารจัดการข้อมูลการทดสอบกลาง',
    contact: 'ผู้ควบคุมระบบส่วนกลาง',
    role: 'admin'
  }
};

const DEFAULT_LOCAL_SUBMISSIONS = {
  'Test1_2026_0': {
    userId: 'local_test1_uid',
    username: 'Test1',
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
  'Test1_2026_1': {
    userId: 'local_test1_uid',
    username: 'Test1',
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
  'Test1_2026_2': {
    userId: 'local_test1_uid',
    username: 'Test1',
    year: 2026,
    monthIndex: 2,
    results: {
      'test_a': 'Positive (+)',
      'test_b': '110.8',
      'test_c': 'พบปฏิกิริยาชัดเจน ตรวจซ้ำยืนยันแล้ว'
    },
    remarks: 'ทดสอบซ้ำด้วยชุดตรวจล็อตใหม่ ผลตรงกัน',
    submittedAt: '2026-03-27 16:00'
  },
  'Test2_2026_0': {
    userId: 'local_test2_uid',
    username: 'Test2',
    year: 2026,
    monthIndex: 0,
    results: {
      'test_a': 'Negative (-)',
      'test_b': '88.2',
      'test_c': 'ระดับความเข้มข้นสม่ำเสมอ'
    },
    remarks: '',
    submittedAt: '2026-01-28 09:40'
  },
  'Test2_2026_1': {
    userId: 'local_test2_uid',
    username: 'Test2',
    year: 2026,
    monthIndex: 1,
    results: {
      'test_a': 'Borderline / Inconclusive',
      'test_b': '99.0',
      'test_c': 'อยู่บริเวณขอบเขตก้ำกึ่ง'
    },
    remarks: 'ขอคำปรึกษาศูนย์ควบคุมคุณภาพ',
    submittedAt: '2026-02-26 11:20'
  }
};

// ============================================================================
// Service API Layer (Unified Interface for Auth & Data)
// ============================================================================

/**
 * Login function (Converts Username -> internal email if needed)
 */
export async function apiLogin(usernameInput, password) {
  const username = usernameInput.trim();

  if (isFirebaseConfigured && auth && db) {
    // Firebase Auth Mode
    const email = username.includes('@') ? username : `${username.toLowerCase()}@portal.local`;
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    
    if (userDoc.exists()) {
      return { uid: userCredential.user.uid, ...userDoc.data() };
    } else {
      // Fallback user object from Auth
      return {
        uid: userCredential.user.uid,
        username,
        email: userCredential.user.email,
        name: username,
        role: username.toLowerCase() === 'admin' ? 'admin' : 'user'
      };
    }
  } else {
    // Local / Demo Mode (Test1/Test1, Test2/Test2, admin/admin)
    if (LOCAL_USERS[username] && password === username) {
      localStorage.setItem('portal_current_user', JSON.stringify(LOCAL_USERS[username]));
      return LOCAL_USERS[username];
    }
    throw new Error('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
  }
}

/**
 * Logout function
 */
export async function apiLogout() {
  if (isFirebaseConfigured && auth) {
    await signOut(auth);
  }
  localStorage.removeItem('portal_current_user');
}

/**
 * Get Current Active User
 */
export async function apiGetCurrentUser() {
  if (isFirebaseConfigured && auth && db) {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              resolve({ uid: user.uid, ...userDoc.data() });
              return;
            }
          } catch (e) {
            console.error('Error fetching user profile:', e);
          }
          resolve({
            uid: user.uid,
            username: user.email?.split('@')[0] || 'User',
            name: user.email?.split('@')[0] || 'User',
            role: user.email?.startsWith('admin') ? 'admin' : 'user'
          });
        } else {
          resolve(null);
        }
      });
    });
  } else {
    const raw = localStorage.getItem('portal_current_user');
    return raw ? JSON.parse(raw) : null;
  }
}

/**
 * Fetch Test Configurations (Test A, B, C...)
 */
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

  // Local fallback
  const raw = localStorage.getItem('portal_test_configs');
  if (!raw) {
    localStorage.setItem('portal_test_configs', JSON.stringify(DEFAULT_TEST_CONFIGS));
    return DEFAULT_TEST_CONFIGS;
  }
  return JSON.parse(raw);
}

/**
 * Save or Update a Test Configuration
 */
export async function apiSaveTestConfig(config) {
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'test_configs', config.id);
    await setDoc(docRef, config, { merge: true });
    return;
  }

  // Local fallback
  const list = await apiGetTestConfigs();
  const idx = list.findIndex(t => t.id === config.id);
  if (idx >= 0) {
    list[idx] = config;
  } else {
    list.push(config);
  }
  localStorage.setItem('portal_test_configs', JSON.stringify(list));
}

/**
 * Delete a Test Configuration
 */
export async function apiDeleteTestConfig(testId) {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, 'test_configs', testId));
    return;
  }

  // Local fallback
  const list = await apiGetTestConfigs();
  const filtered = list.filter(t => t.id !== testId);
  localStorage.setItem('portal_test_configs', JSON.stringify(filtered));
}

/**
 * Fetch All Submissions
 */
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

  // Local fallback
  const raw = localStorage.getItem('portal_submissions');
  if (!raw) {
    localStorage.setItem('portal_submissions', JSON.stringify(DEFAULT_LOCAL_SUBMISSIONS));
    return DEFAULT_LOCAL_SUBMISSIONS;
  }
  return JSON.parse(raw);
}

/**
 * Save / Update a Submission
 */
export async function apiSaveSubmission(submissionKey, submissionData) {
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'submissions', submissionKey);
    await setDoc(docRef, submissionData, { merge: true });
    return;
  }

  // Local fallback
  const submissions = await apiGetSubmissions();
  submissions[submissionKey] = submissionData;
  localStorage.setItem('portal_submissions', JSON.stringify(submissions));
}

/**
 * Delete a Submission
 */
export async function apiDeleteSubmission(submissionKey) {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, 'submissions', submissionKey));
    return;
  }

  // Local fallback
  const submissions = await apiGetSubmissions();
  delete submissions[submissionKey];
  localStorage.setItem('portal_submissions', JSON.stringify(submissions));
}

/**
 * Seed initial data to Firestore (Utility for Admin)
 */
export async function apiSeedFirestore() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('ยังไม่ได้เชื่อมต่อ Firebase หรือไม่ได้ตั้งค่าใน .env');
  }

  // 1. Seed Test Configs
  for (const t of DEFAULT_TEST_CONFIGS) {
    await setDoc(doc(db, 'test_configs', t.id), t);
  }

  // 2. Seed Default Submissions
  for (const [key, sub] of Object.entries(DEFAULT_LOCAL_SUBMISSIONS)) {
    await setDoc(doc(db, 'submissions', key), sub);
  }

  return true;
}
