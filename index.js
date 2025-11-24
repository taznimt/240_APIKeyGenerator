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