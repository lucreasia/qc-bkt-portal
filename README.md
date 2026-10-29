# ระบบรายงานผลการทดสอบประจำเดือน (Monthly Test Result Portal)

ระบบเว็บแอปพลิเคชันสำหรับรายงานและติดตามผลการทดสอบทางห้องปฏิบัติการประจำเดือน พัฒนาด้วยสถาปัตยกรรมพร้อมขึ้น **Production** บน **Netlify** (Frontend) และ **Google Firebase** (Authentication & Cloud Firestore)

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```
monthly_test_portal/
├── .env.example          # ตัวอย่าง Environment Variables สำหรับ Firebase
├── .env                  # ไฟล์ตั้งค่า Firebase Config (Git Ignored)
├── .gitignore            # กำหนดไฟล์ที่ไม่ต้องนำขึ้น Git
├── firestore.rules       # กฎความปลอดภัยของ Firestore (แยกสิทธิ์ User / Admin)
├── index.html            # โครงสร้างหน้าเว็บหลัก (HTML5 + Tailwind CSS)
├── netlify.toml          # ไฟล์คอนฟิกสำหรับการ Deploy บน Netlify
├── package.json          # กำหนด Dependencies (Vite, Firebase, html2pdf.js)
├── vite.config.js        # คอนฟิกการ Build ของ Vite
├── public/               # ไฟล์ Static Assets
└── src/
    ├── firebase.js       # โมดูลเชื่อมต่อ Firebase Auth & Firestore + Local Fallback
    └── main.js           # ควบคุมการทำงานของระบบ (Controller & UI Events)
```

---

## 🚀 วิธีเปิดทดสอบในเครื่อง (Local Development)

1. ติดตั้ง Dependencies:
   ```bash
   npm install
   ```

2. รัน Local Development Server:
   ```bash
   npm run dev
   ```

3. เปิดเบราว์เซอร์ไปที่: `http://localhost:3000`

> **หมายเหตุ**: ระบบมีระบบ **Local Fallback Mode** ในตัว แม้ยังไม่ได้ใส่ Firebase Key ก็สามารถเปิดทดสอบระบบล็อกอิน (`Test1`, `Test2`, `admin`), บันทึกผล, ดูผลย้อนหลัง และดาวน์โหลด PDF ได้ทันที

---

## 🔐 ข้อมูลบัญชีผู้ใช้งานสำหรับทดสอบ (Test Accounts)

| ผู้ใช้งาน | Username | Password | สิทธิ์การใช้งาน |
| :--- | :--- | :--- | :--- |
| **หน่วยงานที่ 1** | `Test1` | `Test1` | ลงผลรายเดือน, ดูผลย้อนหลังของตนเอง |
| **หน่วยงานที่ 2** | `Test2` | `Test2` | ลงผลรายเดือน, ดูผลย้อนหลังของตนเอง |
| **ผู้ดูแลระบบ** | `admin` | `admin` | ตรวจสอบผลทุกหน่วยงาน, ตั้งค่า Test, พิมพ์/ออก PDF |

---

## ☁️ ขั้นตอนการขึ้น Production จริง (Firebase + Netlify)

### ขั้นตอนที่ 1: ตั้งค่า Google Firebase
1. ไปที่ [Firebase Console](https://console.firebase.google.com/) แล้วกด **Add project** (เช่น ตั้งชื่อว่า `monthly-test-portal`)
2. เข้าเมนู **Authentication** > กด **Get Started** > เปิดใช้งาน Sign-in method แบบ **Email/Password**
3. เข้าเมนู **Firestore Database** > กด **Create database** ในโหมด Production
4. คัดลอกเนื้อหาจากไฟล์ `firestore.rules` ไปวางในแท็บ **Rules** ของ Firestore แล้วกด **Publish**
5. ไปที่ **Project Settings** (ไอคอนฟันเฟือง) > เลื่อนลงมาที่หมวด Your apps > กดไอคอนเว็บ `</>` เพื่อคัดลอกค่า `firebaseConfig`
6. เปิดไฟล์ `.env` ในโปรเจกต์ แล้วนำค่า Config มาใส่:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456...
   VITE_FIREBASE_APP_ID=1:123456...
   ```

---

### ขั้นตอนที่ 2: นำโค้ดขึ้น GitHub
1. เปิด Terminal ในโฟลเดอร์นี้ แล้วสั่ง:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Monthly Test Result Portal"
   ```
2. สร้าง Repository ใหม่บน GitHub ของคุณ (ตั้งชื่อเช่น `monthly-test-portal`)
3. เชื่อมต่อและ Push โค้ดขึ้น GitHub:
   ```bash
   git remote add origin https://github.com/<your-username>/monthly-test-portal.git
   git branch -M main
   git push -u origin main
   ```

---

### ขั้นตอนที่ 3: Deploy ขึ้น Netlify
1. เข้าสู่ระบบ [Netlify](https://app.netlify.com/)
2. กด **Add new site** > **Import an existing project** > เลือก **GitHub**
3. เลือก Repository `monthly-test-portal`
4. Netlify จะตรวจจับไฟล์ `netlify.toml` ให้อัตโนมัติ:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. ไปที่ **Site configuration** > **Environment variables** > เพิ่มค่าตัวแปร `VITE_FIREBASE_*` ทั้ง 6 ตัวจากขั้นตอนที่ 1
6. กด **Deploy site**

---

### ขั้นตอนที่ 4: เพิ่ม Domain บน Firebase Authorized Domains
เมื่อได้ URL จาก Netlify แล้ว (เช่น `https://monthly-test-portal.netlify.app`):
1. กลับไปที่ **Firebase Console** > **Authentication** > แท็บ **Settings**
2. เลื่อนลงมาที่หัวข้อ **Authorized domains**
3. กด **Add domain** แล้วใส่ชื่อโดเมนของ Netlify ลงไป เพื่ออนุญาตให้ระบบเข้าสู่ระบบได้จริง
