require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase())
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
});

const app = express();
const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'petmatch',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z'
});

const sessionStore = new MySQLStore({
  clearExpired: true,
  checkExpirationInterval: 900000,
  createDatabaseTable: true
}, pool);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  name: 'petmatch.sid',
  secret: process.env.SESSION_SECRET || 'development-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const requireAuth = (req, res, next) => req.session.user ? next() : res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
const requireAdmin = (req, res, next) => req.session.user?.role === 'admin' ? next() : res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้น' });
const safeUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });

// --- Health & Authentication ---

app.get('/api/health', asyncRoute(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, service: 'PetMatch API' });
}));

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || String(password).length < 8) {
    return res.status(400).json({ error: 'กรอกข้อมูลให้ครบ และรหัสผ่านอย่างน้อย 8 ตัวอักษร' });
  }

  const [exists] = await pool.execute('SELECT id FROM users WHERE email=?', [String(email).trim().toLowerCase()]);
  if (exists.length) return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });

  const hash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute(
    "INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'user')",
    [String(name).trim(), String(email).trim().toLowerCase(), hash]
  );

  req.session.user = {
    id: result.insertId,
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    role: 'user'
  };
  res.status(201).json({ user: req.session.user });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const [rows] = await pool.execute('SELECT * FROM users WHERE email=?', [email]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }

  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'เข้าสู่ระบบไม่สำเร็จ' });
    req.session.user = safeUser(rows[0]);
    res.json({ user: req.session.user });
  });
}));

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('petmatch.sid');
    res.json({ ok: true });
  });
});

// --- Public Pets & Stats ---

app.get('/api/stats', asyncRoute(async (req, res) => {
  const [[a]] = await pool.query("SELECT COUNT(*) total FROM pets WHERE status='available'");
  const [[h]] = await pool.query("SELECT COUNT(*) total FROM pets WHERE status='adopted'");
  const [[u]] = await pool.query("SELECT COUNT(*) total FROM users WHERE role='user'");
  res.json({ available: a.total, adopted: h.total, members: u.total });
}));

app.get('/api/pets', asyncRoute(async (req, res) => {
  const where = ["p.status IN ('available','pending')"];
  const args = [];

  if (['dog', 'cat'].includes(req.query.type)) {
    where.push('p.type=?');
    args.push(req.query.type);
  }
  if (req.query.q) {
    where.push('(p.name LIKE ? OR p.breed LIKE ? OR p.description LIKE ?)');
    const q = '%' + String(req.query.q).slice(0, 80) + '%';
    args.push(q, q, q);
  }
  if (req.query.area) {
    where.push('p.area LIKE ?');
    args.push('%' + String(req.query.area).slice(0, 100) + '%');
  }

  const [rows] = await pool.execute(
    `SELECT p.*, (SELECT image_path FROM pet_images WHERE pet_id=p.id ORDER BY is_primary DESC,id ASC LIMIT 1) image FROM pets p WHERE ${where.join(' AND ')} ORDER BY p.featured DESC,p.created_at DESC LIMIT 100`,
    args
  );
  res.json(rows);
}));

app.get('/api/pets/:id', asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM pets WHERE id=?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'ไม่พบข้อมูลสัตว์' });

  const [images] = await pool.execute('SELECT id,image_path,is_primary FROM pet_images WHERE pet_id=? ORDER BY is_primary DESC,id', [req.params.id]);
  res.json({ ...rows[0], images });
}));

app.get('/api/map/pets', asyncRoute(async (req, res) => {
  const [rows] = await pool.query(
    "SELECT p.id,p.name,p.type,p.age,p.area,p.latitude,p.longitude,p.status,(SELECT image_path FROM pet_images WHERE pet_id=p.id ORDER BY is_primary DESC,id LIMIT 1) image FROM pets p WHERE p.status IN ('available','pending') AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL"
  );
  res.json(rows);
}));

// --- User Features (Favorites & Adoptions) ---

app.get('/api/favorites', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT p.*,f.created_at favorited_at,(SELECT image_path FROM pet_images WHERE pet_id=p.id ORDER BY is_primary DESC,id LIMIT 1) image FROM favorites f JOIN pets p ON p.id=f.pet_id WHERE f.user_id=? ORDER BY f.created_at DESC',
    [req.session.user.id]
  );
  res.json(rows);
}));

app.post('/api/favorites/:petId', requireAuth, asyncRoute(async (req, res) => {
  try {
    await pool.execute('INSERT INTO favorites(user_id,pet_id) VALUES(?,?)', [req.session.user.id, req.params.petId]);
    res.status(201).json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.json({ ok: true, exists: true });
    if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(404).json({ error: 'ไม่พบสัตว์ตัวนี้' });
    throw e;
  }
}));

app.delete('/api/favorites/:petId', requireAuth, asyncRoute(async (req, res) => {
  await pool.execute('DELETE FROM favorites WHERE user_id=? AND pet_id=?', [req.session.user.id, req.params.petId]);
  res.json({ ok: true });
}));

app.post('/api/adoptions', requireAuth, asyncRoute(async (req, res) => {
  const { pet_id, message, phone, address } = req.body;
  if (!pet_id || !phone || !address) return res.status(400).json({ error: 'กรุณากรอกเบอร์โทรศัพท์และที่อยู่' });

  const [p] = await pool.execute("SELECT id FROM pets WHERE id=? AND status='available'", [pet_id]);
  if (!p.length) return res.status(409).json({ error: 'สัตว์ตัวนี้ไม่พร้อมรับคำขอแล้ว' });

  try {
    const [r] = await pool.execute(
      "INSERT INTO adoption_requests(user_id,pet_id,message,phone,address,status) VALUES(?,?,?,?,?,'pending')",
      [req.session.user.id, pet_id, message || '', phone, address]
    );
    res.status(201).json({ id: r.insertId, status: 'pending' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'คุณส่งคำขอสัตว์ตัวนี้ไปแล้ว' });
    throw e;
  }
}));

app.get('/api/adoptions/mine', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT ar.*,p.name pet_name FROM adoption_requests ar JOIN pets p ON p.id=ar.pet_id WHERE ar.user_id=? ORDER BY ar.created_at DESC',
    [req.session.user.id]
  );
  res.json(rows);
}));

// --- Admin APIs ---

app.post(
  '/api/admin/pets/:id/images',
  requireAuth,
  requireAdmin,
  (req, res, next) => upload.array('images', 8)(req, res, err => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'รูปภาพต้องมีขนาดไม่เกิน 5 MB'
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'อัปโหลดได้ครั้งละไม่เกิน 8 รูป'
          : 'รองรับเฉพาะไฟล์ JPEG, PNG และ WebP';
      return res.status(400).json({ error: message });
    }
    next();
  }),
  asyncRoute(async (req, res) => {
    const petId = req.params.id;
    const [pet] = await pool.execute('SELECT id FROM pets WHERE id=?', [petId]);
    if (!pet.length) {
      (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
      return res.status(404).json({ error: 'ไม่พบข้อมูลสัตว์' });
    }

    if (!req.files?.length) return res.status(400).json({ error: 'กรุณาเลือกไฟล์รูปภาพ JPEG, PNG หรือ WebP' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('UPDATE pet_images SET is_primary=0 WHERE pet_id=?', [petId]);

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        await conn.execute(
          'INSERT INTO pet_images(pet_id,image_path,is_primary) VALUES(?,?,?)',
          [petId, '/uploads/' + file.filename, i === 0 ? 1 : 0]
        );
      }

      await conn.commit();
      res.status(201).json({ uploaded: req.files.length, primary: '/uploads/' + req.files[0].filename });
    } catch (err) {
      await conn.rollback();
      (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
      throw err;
    } finally {
      conn.release();
    }
  })
);

app.delete('/api/admin/images/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM pet_images WHERE id=?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'ไม่พบรูปภาพ' });

  await pool.execute('DELETE FROM pet_images WHERE id=?', [req.params.id]);
  const filepath = path.join(uploadDir, path.basename(rows[0].image_path));
  fs.unlink(filepath, () => {});
  res.json({ ok: true });
}));

app.get('/api/admin/pets', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT p.*,(SELECT image_path FROM pet_images WHERE pet_id=p.id ORDER BY is_primary DESC,id LIMIT 1) image FROM pets p ORDER BY p.created_at DESC'
  );
  res.json(rows);
}));

app.post('/api/admin/pets', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const b = req.body;
  if (!b.name || !['dog', 'cat'].includes(b.type)) return res.status(400).json({ error: 'กรุณากรอกชื่อและประเภทสัตว์' });

  const [r] = await pool.execute(
    'INSERT INTO pets(name,type,breed,age,gender,size,description,health_status,area,address,latitude,longitude,status,featured) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [
      b.name,
      b.type,
      b.breed || '',
      b.age || '',
      b.gender || 'unknown',
      b.size || 'medium',
      b.description || '',
      b.health_status || '',
      b.area || '',
      b.address || '',
      b.latitude || null,
      b.longitude || null,
      b.status || 'available',
      b.featured ? 1 : 0
    ]
  );
  res.status(201).json({ id: r.insertId });
}));

app.put('/api/admin/pets/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const b = req.body;
  await pool.execute(
    'UPDATE pets SET name=?,type=?,breed=?,age=?,gender=?,size=?,description=?,health_status=?,area=?,address=?,latitude=?,longitude=?,status=?,featured=? WHERE id=?',
    [
      b.name,
      b.type,
      b.breed || '',
      b.age || '',
      b.gender || 'unknown',
      b.size || 'medium',
      b.description || '',
      b.health_status || '',
      b.area || '',
      b.address || '',
      b.latitude || null,
      b.longitude || null,
      b.status || 'available',
      b.featured ? 1 : 0,
      req.params.id
    ]
  );
  res.json({ ok: true });
}));

app.delete('/api/admin/pets/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  await pool.execute('DELETE FROM pets WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/admin/users', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const [rows] = await pool.query('SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC');
  res.json(rows);
}));

app.get('/api/admin/adoptions', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT ar.*,u.name user_name,u.email,p.name pet_name FROM adoption_requests ar JOIN users u ON u.id=ar.user_id JOIN pets p ON p.id=ar.pet_id ORDER BY ar.created_at DESC'
  );
  res.json(rows);
}));

app.patch('/api/admin/adoptions/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const status = req.body.status;
  if (!['pending', 'approved', 'rejected', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.execute('UPDATE adoption_requests SET status=? WHERE id=?', [status, req.params.id]);

    if (!r.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบคำขอ' });
    }

    if (status === 'completed') {
      const [[a]] = await conn.execute('SELECT pet_id FROM adoption_requests WHERE id=?', [req.params.id]);
      await conn.execute("UPDATE pets SET status='adopted' WHERE id=?", [a.pet_id]);
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

// --- Error Handling & App Start ---

app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ API ที่ร้องขอ' }));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
});

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('MySQL connected');
  } catch (e) {
    console.error('MySQL is not ready:', e.message);
  }
  app.listen(PORT, () => console.log(`PetMatch running at http://localhost:${PORT}`));
}

start();