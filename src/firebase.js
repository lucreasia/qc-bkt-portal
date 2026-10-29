// ============================================================================
// Firebase SDK Initializer & Pure Cloud Firestore Sync (100% Real-Time DB)
// ============================================================================

import { initializeApp, deleteApp } from 'firebase/app';
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
    console.log('[Firebase] Connected to Cloud Firestore Project:', firebaseConfig.projectId);
  } catch (err) {
    console.error('[Firebase] Critical Init Error:', err);
  }
}

export { auth, db };

// ============================================================================
// Default Test Configurations (Initial Cloud Firestore Blueprint)
// ============================================================================
const DEFAULT_TEST_CONFIGS = [
  {
    id: 'test_glucose',
    key: 'GLUCOSE',
    name: 'การตรวจวัดระดับน้ำตาล (Glucose)',
    description: 'การทดสอบระดับน้ำตาลในเลือด รายงานผลแยกตามระดับและเครื่องตรวจ',
    type: 'number',
    unit: 'mg/dL',
    enableLevels: true,
    levels: ['LV1', 'LV2', 'LV3'],
    enableMultiMachine: true,
    maxMachines: 3,
    options: [],
    order: 1
  },
  {
    id: 'test_a',
    key: 'TEST_A',
    name: 'Test A (Qualitative)',
    description: 'การทดสอบความไวเชิงคุณภาพ',
    type: 'select',
    unit: '',
    enableLevels: true,
    levels: ['LV1', 'LV2'],
    enableMultiMachine: false,
    maxMachines: 1,
    options: ['Positive (+)', 'Negative (-)', 'Borderline'],
    order: 2
  },
  {
    id: 'test_b',
    key: 'TEST_B',
    name: 'Test B (Single Numeric)',
    description: 'การวัดค่าระดับความเข้มข้นเชิงปริมาณแบบเครื่องเดียว',
    type: 'number',
    unit: 'IU/mL',
    enableLevels: false,
    levels: ['Default'],
    enableMultiMachine: false,
    maxMachines: 1,
    options: [],
    order: 3
  }
];

export function normalizeUserEmail(input) {
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  return `${trimmed.toLowerCase()}@bkt.com`;
}

// ============================================================================
// 1. Authentication (Firebase Auth Only)
// ============================================================================
export async function apiLogin(userInput, password) {
  const email = normalizeUserEmail(userInput);
  const username = email.split('@')[0];
  const isSuperAdmin = (email === 'adminbkt@bkt.com' || email === 'admin@bkt.com' || username === 'adminbkt');

  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error('ไม่พบการตั้งค่าเชื่อมต่อ Firebase');
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);

    let userData;
    if (userDoc.exists()) {
      userData = { uid, ...userDoc.data() };
      if (isSuperAdmin && userData.role !== 'admin') {
        userData.role = 'admin';
        await setDoc(userDocRef, { role: 'admin' }, { merge: true });
      }
    } else {
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
      await setDoc(userDocRef, userData, { merge: true });
    }

    // Only session indicator in local storage
    localStorage.setItem('portal_current_user', JSON.stringify(userData));
    return userData;
  } catch (firebaseErr) {
    console.error('[Firebase Auth Login Error]:', firebaseErr.code, firebaseErr.message);

    // Auto-create superadmin in Firebase Auth if not exists yet
    if (isSuperAdmin && password === 'adminbkt' && (firebaseErr.code === 'auth/invalid-credential' || firebaseErr.code === 'auth/user-not-found')) {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = newCred.user.uid;
        const adminData = {
          uid,
          email,
          username: 'adminbkt',
          name: 'ผู้ดูแลระบบส่วนกลาง (BKT Super Admin)',
          code: 'ADMIN-HQ',
          department: 'ศูนย์บริหารจัดการข้อมูลกลาง',
          contact: 'ผู้ควบคุมระบบส่วนกลาง',
          role: 'admin',
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', uid), adminData, { merge: true });
        localStorage.setItem('portal_current_user', JSON.stringify(adminData));
        return adminData;
      } catch (createErr) {
        console.error('Auto-creation of admin failed:', createErr);
      }
    }

    if (firebaseErr.code === 'auth/invalid-credential' || firebaseErr.code === 'auth/user-not-found' || firebaseErr.code === 'auth/wrong-password') {
      throw new Error('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
    }
    throw new Error(`การเข้าสู่ระบบขัดข้อง: ${firebaseErr.message}`);
  }
}

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

export async function apiGetCurrentUser() {
  if (!isFirebaseConfigured || !auth || !db) return null;

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
          console.error('Error fetching user profile from Firestore:', e);
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
        localStorage.removeItem('portal_current_user');
        resolve(null);
      }
    });
  });
}

// ============================================================================
// 2. User Management API (Direct Cloud Firestore Only)
// ============================================================================
export async function apiGetUsers() {
  if (!isFirebaseConfigured || !db) return [];

  try {
    const snap = await getDocs(collection(db, 'users'));
    const list = [];
    snap.forEach(d => list.push({ uid: d.id, ...d.data() }));
    return list;
  } catch (e) {
    console.error('[Firestore Error] apiGetUsers failed:', e);
    throw new Error('ไม่สามารถโหลดข้อมูลผู้ใช้งานจาก Cloud Firestore ได้ (กรุณาตรวจสอบ Rules ใน Firebase Console)');
  }
}

export async function apiCreateUserByAdmin({ email, password, name, code, department, contact, role }) {
  const normEmail = normalizeUserEmail(email);
  const username = normEmail.split('@')[0];

  if (!isFirebaseConfigured || !db) {
    throw new Error('ระบบยังไม่ได้เชื่อมต่อ Firebase');
  }

  const secondaryAppName = `AdminCreator_${Date.now()}`;
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
      department: department || 'แผนกห้องปฏิบัติการมาตรฐาน',
      contact: contact || '-',
      role: role || 'user',
      createdAt: new Date().toISOString()
    };

    // Save directly to main Cloud Firestore
    await setDoc(doc(db, 'users', newUid), newUserDoc);

    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});

    return newUserDoc;
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

export async function apiUpdateUser(uid, updates) {
  if (!isFirebaseConfigured || !db) return;
  try {
    await updateDoc(doc(db, 'users', uid), updates);
  } catch (e) {
    console.error('[Firestore Error] apiUpdateUser failed:', e);
    throw new Error('ไม่สามารถอัปเดตข้อมูลผู้ใช้งานบน Cloud Firestore ได้');
  }
}

export async function apiDeleteUser(uid) {
  if (!isFirebaseConfigured || !db) return;
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (e) {
    console.error('[Firestore Error] apiDeleteUser failed:', e);
    throw new Error('ไม่สามารถลบผู้ใช้งานบน Cloud Firestore ได้');
  }
}

// ============================================================================
// 3. Test Configurations API (Direct Cloud Firestore Only)
// ============================================================================
export async function apiGetTestConfigs() {
  if (!isFirebaseConfigured || !db) return DEFAULT_TEST_CONFIGS;

  try {
    const q = query(collection(db, 'test_configs'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));

    // If completely empty in Firestore, seed initial defaults directly into Firestore
    if (list.length === 0) {
      for (const item of DEFAULT_TEST_CONFIGS) {
        await setDoc(doc(db, 'test_configs', item.id), item);
      }
      return DEFAULT_TEST_CONFIGS;
    }
    return list;
  } catch (e) {
    console.error('[Firestore Error] apiGetTestConfigs failed:', e);
    throw new Error('ไม่สามารถโหลดข้อมูลแบบทดสอบจาก Cloud Firestore ได้');
  }
}

export async function apiSaveTestConfig(config) {
  if (!isFirebaseConfigured || !db) throw new Error('ระบบยังไม่ได้เชื่อมต่อ Firebase');

  try {
    const docRef = doc(db, 'test_configs', config.id);
    await setDoc(docRef, config, { merge: true });
  } catch (e) {
    console.error('[Firestore Error] apiSaveTestConfig failed:', e);
    throw new Error(`ไม่สามารถบันทึกแบบทดสอบลง Cloud Firestore: ${e.message}`);
  }
}

export async function apiDeleteTestConfig(testId) {
  if (!isFirebaseConfigured || !db) return;

  try {
    await deleteDoc(doc(db, 'test_configs', testId));
  } catch (e) {
    console.error('[Firestore Error] apiDeleteTestConfig failed:', e);
    throw new Error(`ไม่สามารถลบแบบทดสอบบน Cloud Firestore: ${e.message}`);
  }
}

// ============================================================================
// 4. Monthly Lot & Answer Key API (Direct Cloud Firestore Only)
// ============================================================================
export async function apiGetMonthlyLots() {
  if (!isFirebaseConfigured || !db) return {};

  try {
    const snap = await getDocs(collection(db, 'monthly_lots'));
    const map = {};
    snap.forEach(d => {
      map[d.id] = d.data();
    });
    return map;
  } catch (e) {
    console.error('[Firestore Error] apiGetMonthlyLots failed:', e);
    throw new Error('ไม่สามารถโหลดข้อมูล Lot ประจำเดือนจาก Cloud Firestore ได้');
  }
}

export async function apiSaveMonthlyLot(lotKey, lotData) {
  if (!isFirebaseConfigured || !db) throw new Error('ระบบยังไม่ได้เชื่อมต่อ Firebase');

  try {
    const docRef = doc(db, 'monthly_lots', lotKey);
    await setDoc(docRef, lotData, { merge: true });
  } catch (e) {
    console.error('[Firestore Error] apiSaveMonthlyLot failed:', e);
    throw new Error(`ไม่สามารถบันทึก Lot ประจำเดือนลง Cloud Firestore: ${e.message}`);
  }
}

// ============================================================================
// 5. Submissions API (Direct Cloud Firestore Only)
// ============================================================================
export async function apiGetSubmissions() {
  if (!isFirebaseConfigured || !db) return {};

  try {
    const snap = await getDocs(collection(db, 'submissions'));
    const map = {};
    snap.forEach(d => {
      map[d.id] = d.data();
    });
    return map;
  } catch (e) {
    console.error('[Firestore Error] apiGetSubmissions failed:', e);
    throw new Error('ไม่สามารถโหลดข้อมูลผลการทดสอบจาก Cloud Firestore ได้');
  }
}

export async function apiSaveSubmission(submissionKey, submissionData) {
  if (!isFirebaseConfigured || !db) throw new Error('ระบบยังไม่ได้เชื่อมต่อ Firebase');

  try {
    const docRef = doc(db, 'submissions', submissionKey);
    await setDoc(docRef, submissionData, { merge: true });
  } catch (e) {
    console.error('[Firestore Error] apiSaveSubmission failed:', e);
    throw new Error(`ไม่สามารถบันทึกผลการทดสอบลง Cloud Firestore: ${e.message}`);
  }
}

export async function apiDeleteSubmission(submissionKey) {
  if (!isFirebaseConfigured || !db) return;

  try {
    await deleteDoc(doc(db, 'submissions', submissionKey));
  } catch (e) {
    console.error('[Firestore Error] apiDeleteSubmission failed:', e);
    throw new Error(`ไม่สามารถลบผลการทดสอบบน Cloud Firestore: ${e.message}`);
  }
}
