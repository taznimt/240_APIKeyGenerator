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
