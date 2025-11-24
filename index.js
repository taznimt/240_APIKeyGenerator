const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== CONNECT DATABASE ==================
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Itam4869',
  database: 'jihoon',
  port: 3307
});

db.connect((err) => {
  if (err) console.error('❌ DB ERROR:', err);
  else console.log('✅ DB Connected (jihoon)');
});

// ================== JWT SECRET ==================
const JWT_SECRET = 'rahasia-super-aman';

// ================== MIDDLEWARE AUTH ==================
function authAdmin(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token tidak ada' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Token tidak valid' });
    req.admin = decoded;
    next();
  });
}

// ================== GENERATE API KEY ==================
function generateApiKey() {
  return "API-" + crypto.randomBytes(16).toString('hex').toUpperCase();
}

// =======================================================
//                     USER REGISTER
// =======================================================
app.post('/register-user', (req, res) => {
  const { firstname, lastname, email } = req.body;

  if (!firstname || !lastname || !email)
    return res.status(400).json({ message: 'Semua field wajib diisi' });

  const sqlUser = 'INSERT INTO user (firstname, lastname, email) VALUES (?, ?, ?)';
  db.query(sqlUser, [firstname, lastname, email], (err, resultUser) => {
    if (err) {
      console.error('❌ Insert user:', err);
      return res.status(500).json({ message: 'Gagal menyimpan user' });
    }

    const idUser = resultUser.insertId;
    const apiKey = generateApiKey();

    const sqlApi = 'INSERT INTO api (`key`, outOfDate, idUser) VALUES (?, DATE_ADD(NOW(), INTERVAL 30 DAY), ?)';
    db.query(sqlApi, [apiKey, idUser], (err2) => {
      if (err2) {
        console.error('❌ Insert API:', err2);
        return res.status(500).json({ message: 'User tersimpan, api key gagal dibuat' });
      }

      res.json({
        message: 'User & API key berhasil dibuat',
        user: { idUser, firstname, lastname, email },
        apiKey
      });
    });
  });
});

// =======================================================
//                     ADMIN REGISTER
// =======================================================
app.post('/admin/register', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'Email & password wajib diisi' });

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ message: 'Gagal hash password' });

    const sql = 'INSERT INTO admin (email, password) VALUES (?, ?)';
    db.query(sql, [email, hash], (err2, result) => {
      if (err2) {
        console.error('❌ Insert admin:', err2);
        return res.status(500).json({ message: 'Gagal menyimpan admin' });
      }

      res.json({ message: 'Admin berhasil diregistrasi' });
    });
  });
});

// =======================================================
//                     ADMIN LOGIN
// =======================================================
app.post('/admin/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'Email & password wajib diisi' });

  db.query('SELECT * FROM admin WHERE email = ?', [email], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Gagal login' });

    if (rows.length === 0)
      return res.status(400).json({ message: 'Admin tidak ditemukan' });

    const admin = rows[0];

    bcrypt.compare(password, admin.password, (err2, match) => {
      if (!match) return res.status(400).json({ message: 'Password salah' });

      const token = jwt.sign(
        { idAdmin: admin.idAdmin, email: admin.email },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.json({ message: 'Login berhasil', token });
    });
  });
});

// =======================================================
//                     GET USERS (ADMIN)
// =======================================================
app.get('/admin/users', authAdmin, (req, res) => {
  const sql = 'SELECT idUser, firstname, lastname, email FROM user';
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Gagal mengambil data user' });
    res.json(rows);
  });
});

// =======================================================
//                     GET API KEYS (ADMIN)
// =======================================================
app.get('/admin/api', authAdmin, (req, res) => {
  const sql = `
    SELECT a.idApi, a.key, a.outOfDate, u.firstname, u.lastname, u.email
    FROM api a
    JOIN user u ON u.idUser = a.idUser
  `;

  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Gagal mengambil data api' });

    const now = new Date();
    rows.forEach(r => {
      r.status = new Date(r.outOfDate) > now ? 'ON' : 'OFF';
    });

    res.json(rows);
  });
});

// =======================================================
//                VALIDASI API KEY (PUBLIC)
// =======================================================
app.post('/validate-api', (req, res) => {
  const { apiKey } = req.body;

  db.query('SELECT * FROM api WHERE `key` = ? AND outOfDate > NOW()', [apiKey], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Gagal validasi' });

    if (rows.length > 0)
      res.json({ valid: true, message: 'API key valid & aktif' });
    else
      res.json({ valid: false, message: 'API key invalid / expired' });
  });
});

// =======================================================
//                DELETE USER + API KEY
// =======================================================
app.delete('/admin/users/:idUser', authAdmin, (req, res) => {
  const { idUser } = req.params;

  db.query('DELETE FROM api WHERE idUser = ?', [idUser], (err) => {
    if (err) return res.status(500).json({ message: 'Gagal hapus API user' });

    db.query('DELETE FROM user WHERE idUser = ?', [idUser], (err2) => {
      if (err2) return res.status(500).json({ message: 'Gagal hapus user' });

      res.json({ message: 'User + semua API key terhapus' });
    });
  });
});

// =======================================================
//                  DELETE API KEY SAJA
// =======================================================
app.delete('/admin/api/:idApi', authAdmin, (req, res) => {
  db.query('DELETE FROM api WHERE idApi = ?', [req.params.idApi], (err) => {
    if (err) return res.status(500).json({ message: 'Gagal hapus API key' });

    res.json({ message: 'API key berhasil dihapus' });
  });
});

// =======================================================
//        STATIC FILES DITEMPATKAN PALING TERAKHIR
// =======================================================
app.use(express.static(path.join(__dirname, 'public')));


// =======================================================
//                     RUN SERVER
// =======================================================
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
