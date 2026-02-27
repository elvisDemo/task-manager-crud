require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Middleware
app.use(cors());
app.use(express.json());

// Auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// ===================
// AUTH ROUTES
// ===================

// POST /api/auth/register - Create new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: 'Email, password, and name are required' });
    }

    // Check if user already exists
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert user
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
        [email, passwordHash, name],
        function (err) {
          if (err) reject(err);
          resolve({ id: this.lastID });
        }
      );
    });

    // Generate JWT
    const token = jwt.sign({ id: result.id, email, name }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    res.status(201).json({
      success: true,
      data: { token, user: { id: result.id, email, name } }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/login - Verify credentials, return JWT
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // Find user
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    res.json({
      success: true,
      data: { token, user: { id: user.id, email: user.email, name: user.name } }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/me - Get current user (protected)
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===================
// TASK ROUTES
// ===================

// GET /api/tasks/stats - Get task counts by status
app.get('/api/tasks/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
          SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
        FROM tasks WHERE user_id = ?`,
        [req.user.id],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/tasks - Get all tasks for logged-in user
app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const tasks = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
        [req.user.id],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });

    res.json({ success: true, data: tasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tasks - Create new task
app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { title, description, status, priority, due_date } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const taskStatus = status || 'todo';
    const taskPriority = priority || 'medium';

    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO tasks (user_id, title, description, status, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, title, description || null, taskStatus, taskPriority, due_date || null],
        function (err) {
          if (err) reject(err);
          resolve({ id: this.lastID });
        }
      );
    });

    // Fetch the created task
    const task = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tasks WHERE id = ?', [result.id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    res.status(201).json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/tasks/:id - Update task
app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, due_date } = req.body;

    // Check if task exists and belongs to user
    const existingTask = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.user.id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!existingTask) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
    }
    if (due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(due_date);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, req.user.id);

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
        values,
        function (err) {
          if (err) reject(err);
          resolve();
        }
      );
    });

    // Fetch updated task
    const updatedTask = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    res.json({ success: true, data: updatedTask });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/tasks/:id - Delete task
app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if task exists and belongs to user
    const existingTask = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.user.id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!existingTask) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    await new Promise((resolve, reject) => {
      db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, req.user.id], function (err) {
        if (err) reject(err);
        resolve();
      });
    });

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Task Manager API is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  db.close();
  process.exit(0);
});
