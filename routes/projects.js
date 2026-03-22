const express = require('express');
const router = express.Router();
const { query } = require('../db/database');

// GET all projects
router.get('/', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single project with slots and videos
router.get('/:id', async (req, res) => {
  try {
    const { rows: [project] } = await query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const [{ rows: characters }, { rows: backgrounds }, { rows: videos }] = await Promise.all([
      query('SELECT * FROM character_slots WHERE project_id = $1 ORDER BY slot_number', [req.params.id]),
      query('SELECT * FROM background_slots WHERE project_id = $1 ORDER BY slot_number', [req.params.id]),
      query('SELECT * FROM videos WHERE project_id = $1 ORDER BY created_at DESC', [req.params.id]),
    ]);

    res.json({ ...project, characters, backgrounds, videos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create project
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const { rows: [project] } = await query(
      'INSERT INTO projects (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update project name
router.patch('/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const { rows: [project] } = await query(
      'UPDATE projects SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [name, req.params.id]
    );
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE project
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
