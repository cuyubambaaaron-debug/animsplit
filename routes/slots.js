const express = require('express');
const router = express.Router();
const multer = require('multer');
const { query } = require('../db/database');
const { uploadFile, getSignedDownloadUrl } = require('../services/storage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// PUT update character slot (creates if not exists)
router.put('/characters/:projectId/:slotNumber', upload.single('reference'), async (req, res) => {
  try {
    const { projectId, slotNumber } = req.params;
    const { name, description } = req.body;

    let referenceImageUrl = null;
    if (req.file) {
      const key = `references/${projectId}/character_${slotNumber}.png`;
      await uploadFile(key, req.file.buffer, req.file.mimetype);
      referenceImageUrl = key;
    }

    const { rows: [slot] } = await query(`
      INSERT INTO character_slots (project_id, slot_number, name, description, reference_image_url)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (project_id, slot_number)
      DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        reference_image_url = COALESCE(EXCLUDED.reference_image_url, character_slots.reference_image_url)
      RETURNING *
    `, [projectId, slotNumber, name, description, referenceImageUrl]);

    res.json(slot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update background slot
router.put('/backgrounds/:projectId/:slotNumber', upload.single('reference'), async (req, res) => {
  try {
    const { projectId, slotNumber } = req.params;
    const { name, description } = req.body;

    let referenceImageUrl = null;
    if (req.file) {
      const key = `references/${projectId}/background_${slotNumber}.png`;
      await uploadFile(key, req.file.buffer, req.file.mimetype);
      referenceImageUrl = key;
    }

    const { rows: [slot] } = await query(`
      INSERT INTO background_slots (project_id, slot_number, name, description, reference_image_url)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (project_id, slot_number)
      DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        reference_image_url = COALESCE(EXCLUDED.reference_image_url, background_slots.reference_image_url)
      RETURNING *
    `, [projectId, slotNumber, name, description, referenceImageUrl]);

    res.json(slot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE character slot
router.delete('/characters/:projectId/:slotNumber', async (req, res) => {
  try {
    await query(
      'DELETE FROM character_slots WHERE project_id = $1 AND slot_number = $2',
      [req.params.projectId, req.params.slotNumber]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE background slot
router.delete('/backgrounds/:projectId/:slotNumber', async (req, res) => {
  try {
    await query(
      'DELETE FROM background_slots WHERE project_id = $1 AND slot_number = $2',
      [req.params.projectId, req.params.slotNumber]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
