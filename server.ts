import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});
const PORT = 3000;

app.use(express.json());

// Database Setup
const dbPath = process.env.DATABASE_PATH || 'tasks.db';
const db = new Database(dbPath);

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL, -- 'manager' or 'staff'
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    deadline TEXT,
    status TEXT NOT NULL, -- 'pending', 'in-progress', 'completed'
    staff_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    priority TEXT NOT NULL DEFAULT 'normal', -- 'urgent' or 'normal'
    FOREIGN KEY (staff_id) REFERENCES users(id)
  );
`);

// Add priority column if it doesn't exist (for existing databases)
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'`);
} catch (e) {
  // Column already exists
}

// Add avatar column if it doesn't exist
try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT`);
} catch (e) {
  // Column already exists
}

// Add manager_name column if it doesn't exist
try {
  db.exec(`ALTER TABLE users ADD COLUMN manager_name TEXT`);
} catch (e) {
  // Column already exists
}

try {
  db.exec(`ALTER TABLE tasks ADD COLUMN updated_at TEXT`);
} catch (e) {}

// Seed data
const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (usersCount.count === 0) {
  const insertUser = db.prepare('INSERT INTO users (id, name, role, password) VALUES (?, ?, ?, ?)');
  insertUser.run('manager-1', 'Alice (Manager)', 'manager', 'manager123');
}

// Emergency Manager Password Reset via Environment Variable
const overridePassword = process.env.MANAGER_PASSWORD_OVERRIDE;
if (overridePassword) {
  const updateManager = db.prepare('UPDATE users SET password = ? WHERE id = ? AND role = ?');
  const result = updateManager.run(overridePassword, 'manager-1', 'manager');
  if (result.changes > 0) {
    console.log('SECURITY: Manager password has been overridden via environment variable.');
  }
}

// FORCE RESET MANAGER (Requested by User)
// This will find any manager and reset them to manager-1 / manager123
try {
  const currentManager = db.prepare("SELECT id FROM users WHERE role = 'manager'").get() as { id: string } | undefined;
  if (currentManager) {
    const oldId = currentManager.id;
    const newId = 'manager-1';
    const newPass = 'manager123';
    
    // Disable FKs temporarily for the reset
    db.exec('PRAGMA foreign_keys = OFF');
    
    // Update tasks if ID is different
    if (oldId !== newId) {
      db.prepare('UPDATE tasks SET staff_id = ? WHERE staff_id = ?').run(newId, oldId);
    }
    
    // Update manager account
    db.prepare("UPDATE users SET id = ?, password = ?, name = 'Alice (Manager)' WHERE role = 'manager'").run(newId, newPass);
    
    // Re-enable FKs
    db.exec('PRAGMA foreign_keys = ON');
    
    console.log('SYSTEM: Manager account has been reset to default (manager-1 / manager123)');
  }
} catch (e) {
  console.error('Failed to force reset manager:', e);
}

// Auth Route
app.post('/api/auth/login', (req, res) => {
  const { id, password } = req.body;
  const user = db.prepare('SELECT id, name, role, avatar, manager_name AS managerName FROM users WHERE id = ? AND password = ?').get(id, password) as any;
  
  if (user) {
    if (user.role === 'staff') {
      const manager = db.prepare("SELECT name FROM users WHERE role = 'manager' LIMIT 1").get() as { name: string } | undefined;
      user.managerName = manager?.name || user.managerName;
    }
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'Invalid ID or password' });
  }
});

// User Management Routes
app.get('/api/users', (req, res) => {
  const manager = db.prepare("SELECT name FROM users WHERE role = 'manager' LIMIT 1").get() as { name: string } | undefined;
  const users = db.prepare('SELECT id, name, role, avatar, manager_name AS managerName FROM users').all();
  
  const processedUsers = users.map(u => ({
    ...u,
    managerName: u.role === 'staff' ? (manager?.name || u.managerName) : u.managerName
  }));
  
  res.json(processedUsers);
});

// Debug Route for Manager to see raw DB content (including passwords)
app.get('/api/admin/debug/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { id, name, role, password } = req.body;
  
  try {
    const insert = db.prepare('INSERT INTO users (id, name, role, password) VALUES (?, ?, ?, ?)');
    insert.run(id, name, role, password);
    
    const manager = db.prepare("SELECT name FROM users WHERE role = 'manager' LIMIT 1").get() as { name: string } | undefined;
    const newUser = db.prepare('SELECT id, name, role, avatar, manager_name AS managerName FROM users WHERE id = ?').get(id) as any;
    
    if (newUser && newUser.role === 'staff') {
      newUser.managerName = manager?.name || newUser.managerName;
    }
    
    io.emit('user:created', newUser);
    res.json(newUser);
  } catch (error) {
    res.status(400).json({ error: 'User ID already exists or invalid data' });
  }
});

app.put('/api/users/:id/profile', (req, res) => {
  const { id } = req.params;
  const { newId, name, password, avatar } = req.body;
  
  try {
    const targetId = newId || id;
    
    // Disable FKs temporarily for the update if ID is changing
    if (newId && newId !== id) {
      db.exec('PRAGMA foreign_keys = OFF');
    }

    // Update tasks if ID is changing
    if (newId && newId !== id) {
      db.prepare('UPDATE tasks SET staff_id = ? WHERE staff_id = ?').run(newId, id);
      io.emit('user:id_changed', { oldId: id, newId });
    }

    // Update user
    if (password) {
      db.prepare('UPDATE users SET id = ?, name = ?, password = ?, avatar = ? WHERE id = ?').run(targetId, name, password, avatar || null, id);
    } else {
      db.prepare('UPDATE users SET id = ?, name = ?, avatar = ? WHERE id = ?').run(targetId, name, avatar || null, id);
    }
    
    // Re-enable FKs
    if (newId && newId !== id) {
      db.exec('PRAGMA foreign_keys = ON');
    }
    
    const manager = db.prepare("SELECT name FROM users WHERE role = 'manager' LIMIT 1").get() as { name: string } | undefined;
    const updatedUser = db.prepare('SELECT id, name, role, avatar, manager_name AS managerName FROM users WHERE id = ?').get(targetId) as any;
    
    if (updatedUser && updatedUser.role === 'staff') {
      updatedUser.managerName = manager?.name || updatedUser.managerName;
    }
    
    io.emit('user:updated', updatedUser);
    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    // Ensure FKs are back on if they were off
    db.exec('PRAGMA foreign_keys = ON');
    res.status(400).json({ error: 'Failed to update profile. ID might already exist.' });
  }
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  
  // Delete user's tasks first
  db.prepare('DELETE FROM tasks WHERE staff_id = ?').run(id);
  // Delete user
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  
  io.emit('user:deleted', id);
  res.json({ success: true });
});

app.get('/api/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const { title, description, deadline, staff_id, priority } = req.body;
  const id = uuidv4();
  
  // Get current time in UTC
  const created_at = new Date().toISOString();
  
  const status = 'pending';
  const taskPriority = priority || 'normal';

  const insert = db.prepare('INSERT INTO tasks (id, title, description, deadline, status, staff_id, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insert.run(id, title, description, deadline, status, staff_id, created_at, taskPriority);

  const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  io.emit('task:created', newTask);
  res.json(newTask);
});

app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, deadline, status, priority } = req.body;
  
  // Get current time in UTC
  const updated_at = new Date().toISOString();

  const update = db.prepare('UPDATE tasks SET title = ?, description = ?, deadline = ?, status = ?, priority = ?, updated_at = ? WHERE id = ?');
  update.run(title, description, deadline, status, priority || 'normal', updated_at, id);

  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  io.emit('task:updated', updatedTask);
  res.json(updatedTask);
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  io.emit('task:deleted', id);
  res.json({ success: true });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
