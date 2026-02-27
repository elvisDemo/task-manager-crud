const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const DB_PATH = process.env.DB_PATH || './database.sqlite';

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database:', DB_PATH);
  }
});

// Create tables
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tasks table
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      due_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log('Database tables created successfully');
});

// Auth routes (placeholder - Day 1 PM)
app.post('/api/auth/register', (req, res) => {
  res.json({ message: 'Register endpoint - to be implemented' });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ message: 'Login endpoint - to be implemented' });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ message: 'Auth me endpoint - to be implemented' });
});

// Task routes (placeholder - Day 2 AM)
app.get('/api/tasks', (req, res) => {
  res.json({ message: 'Get tasks endpoint - to be implemented' });
});

app.post('/api/tasks', (req, res) => {
  res.json({ message: 'Create task endpoint - to be implemented' });
});

app.put('/api/tasks/:id', (req, res) => {
  res.json({ message: 'Update task endpoint - to be implemented' });
});

app.delete('/api/tasks/:id', (req, res) => {
  res.json({ message: 'Delete task endpoint - to be implemented' });
});

app.get('/api/tasks/stats', (req, res) => {
  res.json({ message: 'Task stats endpoint - to be implemented' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});

module.exports = app;
