require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── PostgreSQL pool (Railway) ─────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Auto-create table on startup ──────────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS tasks (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT         DEFAULT '',
    category    VARCHAR(50)  DEFAULT 'general',
    due_date    DATE         DEFAULT NULL,
    priority    VARCHAR(10)  DEFAULT 'medium',
    completed   BOOLEAN      DEFAULT FALSE,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
  );
`)
.then(() => console.log('✅ DB ready'))
.catch(err => { console.error('❌ DB error:', err.message); process.exit(1); });

// ── Middleware ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve frontend files (index.html, style.css) from same folder
app.use(express.static(path.join(__dirname)));

// ── API Routes ────────────────────────────────────────────────────

// GET all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create task
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, category, due_date, priority } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    const { rows } = await pool.query(
      `INSERT INTO tasks (title, description, category, due_date, priority)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title.trim(), description||'', category||'general', due_date||null, priority||'medium']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update/toggle task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { title, description, category, due_date, priority, completed } = req.body;
    const { rows } = await pool.query(
      `UPDATE tasks SET title=$1, description=$2, category=$3,
       due_date=$4, priority=$5, completed=$6 WHERE id=$7 RETURNING *`,
      [title, description||'', category||'general', due_date||null,
       priority||'medium', completed??false, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM tasks WHERE id=$1 RETURNING *', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 TASKR running on http://localhost:${PORT}`));