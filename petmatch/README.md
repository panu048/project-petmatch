# PetMatch — Find Your Forever Friend

เว็บไซต์หาบ้านให้สุนัขและแมว สำหรับโครงงาน Internet Programming ใช้ HTML/CSS/Vanilla JS, Node.js/Express และ MySQL พร้อม Leaflet + OpenStreetMap

## ฟังก์ชัน
- หน้าแรก responsive ภาษาไทย, ค้นหา/กรองสัตว์, รายละเอียดสัตว์
- สมัครสมาชิก/เข้าสู่ระบบด้วย bcrypt และ server-side session ที่จัดเก็บใน MySQL
- รายการโปรด และคำขอรับเลี้ยง
- แผนที่จริง Leaflet/OpenStreetMap แสดงหมุดจากพิกัดใน MySQL
- Admin Dashboard จัดการข้อมูลสัตว์ สมาชิก และคำขอรับเลี้ยง
- Admin เพิ่ม/แก้ไข/ลบสัตว์ อัปโหลดรูป JPEG/PNG/WebP ได้สูงสุด 5 MB ต่อภาพ
- REST API, rate limiting สำหรับ authentication, Helmet, validation เบื้องต้น

## สิ่งที่ต้องติดตั้ง
- Node.js 18+ และ npm
- MySQL 8+

## วิธีติดตั้ง
1. สร้างฐานข้อมูลและตาราง: รันไฟล์ `sql/schema.sql` ใน MySQL Workbench หรือ `mysql -u root -p < sql/schema.sql`
2. คัดลอก `.env.example` เป็น `.env` แล้วแก้ค่า MySQL และ `SESSION_SECRET`
3. ติดตั้ง dependency: `npm install`
4. สร้างบัญชี Admin โดยใช้คำสั่งด้านล่าง
5. เริ่มระบบ: `npm start`
6. เปิด `http://localhost:3000` และ Admin Dashboard ที่ `http://localhost:3000/admin.html`

## สร้างบัญชี Admin
หลังติดตั้ง dependency และตั้งค่า `.env` แล้ว รัน `npm run create-admin` (ใช้ `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` จาก `.env`) จากนั้นเข้าสู่ระบบที่หน้าเว็บ บัญชีผู้ใช้ทั่วไปไม่สามารถสมัครเป็น Admin ได้

> เปลี่ยนรหัสผ่านเริ่มต้นทันที และห้ามใช้ค่าจาก `.env.example` ใน production

## ข้อมูลแผนที่
แผนที่ใช้ tile จาก OpenStreetMap และต้องเชื่อมต่ออินเทอร์เน็ตเพื่อโหลดแผนที่ รูปตัวอย่างบนหน้าแรกใช้ Unsplash หากเพิ่มสัตว์ผ่าน Admin ให้ใส่ latitude/longitude เพื่อแสดงหมุด สถานที่ตั้งในข้อมูลเป็นข้อมูลที่ผู้ดูแลป้อนเอง

## API หลัก
- `GET /api/health`, `GET /api/stats`, `GET /api/pets`, `GET /api/pets/:id`, `GET /api/map/pets`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/POST/DELETE /api/favorites...`, `POST /api/adoptions`, `GET /api/adoptions/mine`
- Admin: `/api/admin/pets`, `/api/admin/pets/:id/images`, `/api/admin/users`, `/api/admin/adoptions`

## ข้อควรทราบ
โปรเจกต์นี้เป็น starter application ที่ใช้งานได้เมื่อกำหนด MySQL และติดตั้ง dependencies แล้ว ไม่ได้รวมข้อมูลสัตว์จริงหรือบัญชี Admin สำเร็จรูปไว้ในฐานข้อมูลโดยอัตโนมัติ ไม่มีการเก็บข้อมูลใน localStorage ใช้ session cookie ฝั่งเซิร์ฟเวอร์แทน
