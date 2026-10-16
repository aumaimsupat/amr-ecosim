# AMR-EcoSim — เวอร์ชันเชื่อม PostgreSQL

เว็บต้นแบบนี้ใช้ Flask เป็น backend, PostgreSQL เป็นฐานข้อมูล และ HTML/CSS/JavaScript เป็นหน้าเว็บ

## ต้องมีอะไรบ้าง
- Python 3.10 ขึ้นไป
- PostgreSQL และ pgAdmin (pgAdmin เป็นเครื่องมือช่วยจัดการฐานข้อมูล ไม่ใช่ตัวฐานข้อมูลเอง)
- ไฟล์ `evol_dynamics.csv` ที่มีคอลัมน์ `AB_conc,nutrient_conc,population,time,surv_frac`

## ขั้นตอนบน Windows

### 1) สร้างฐานข้อมูล
เปิด pgAdmin แล้วเชื่อม PostgreSQL จากนั้นคลิกขวา Databases → Create → Database ตั้งชื่อ `amr_ecosim`.

### 2) สร้างตาราง
เลือกฐานข้อมูล `amr_ecosim` → Tools → Query Tool เปิดไฟล์ `schema.sql` แล้วรัน (ปุ่ม ▶).

### 3) ตั้งค่าโปรเจกต์
แตก ZIP ไปไว้ในโฟลเดอร์ที่ต้องการ แล้วเปิด Command Prompt/PowerShell ในโฟลเดอร์นั้น

```powershell
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

แก้ `.env` ด้วย username/password ของ PostgreSQL ในเครื่องตัวเอง อย่าส่งไฟล์ `.env` หรือรหัสผ่านให้คนอื่น

### 4) นำ CSV เข้า PostgreSQL
คัดลอก `evol_dynamics.csv` มาไว้ในโฟลเดอร์เดียวกับ `app.py` หรือใช้ path เต็ม จากนั้นรัน:

```powershell
python import_csv.py evol_dynamics.csv
```

สคริปต์นี้ใช้ `TRUNCATE` ก่อนนำเข้า ดังนั้นทุกครั้งที่รันจะล้างข้อมูลเดิมในตารางนี้แล้วนำข้อมูลจาก CSV ที่ระบุเข้าใหม่ ตรวจชื่อไฟล์ให้ถูกต้องก่อนรัน

### 5) เปิดเว็บ
```powershell
python -m flask --app app run --debug
```
เปิดเบราว์เซอร์ที่ `http://127.0.0.1:5000`.

### 6) ตรวจว่าข้อมูลเข้าแล้ว
ใน pgAdmin Query Tool รัน:
```sql
SELECT COUNT(*) FROM amr_evol_dynamics;
SELECT * FROM amr_evol_dynamics LIMIT 10;
```
จำนวนแถวควรตรงกับจำนวนข้อมูลที่ไม่รวม header ใน CSV

## โครงสร้างการทำงาน
Browser → Flask API (`/api/...`) → PostgreSQL → ส่ง JSON กลับหน้าเว็บ → อัปเดต KPI/กราฟ/ตาราง

## API ที่มี
- `GET /api/health` — ตรวจการเชื่อมต่อฐานข้อมูล
- `GET /api/summary` — สรุปข้อมูล
- `GET /api/options` — ตัวเลือกระดับยาและสารอาหาร
- `GET /api/compare?dose=25&nutrient=0.5` — สถิติและแนวโน้มตามเวลา
- `GET /api/dose-summary` — ค่าเฉลี่ยแยกตามระดับยา
- `GET /api/data?limit=50&offset=0` — ดูข้อมูลเป็นหน้า

## หมายเหตุวิชาการ
- เว็บนี้วิเคราะห์ข้อมูลที่มีใน CSV ไม่ได้จำลองการวิวัฒนาการโดยตรง
- อย่าเรียก `surv_frac` ว่า “อัตราการดื้อยา” จนกว่าจะตรวจนิยามจาก paper/data dictionary ต้นฉบับ
- ชื่อเชื้อไม่ได้อยู่ในคอลัมน์ที่เว็บใช้ ดังนั้นต้องตรวจสอบ metadata ของงานวิจัยก่อนระบุ species
- ใช้เฉพาะในเครื่องเพื่อการพัฒนา; ก่อนนำขึ้นอินเทอร์เน็ตควรปิด debug mode, ตั้งค่าความปลอดภัย, และไม่เปิด PostgreSQL ให้เข้าถึงสาธารณะ
