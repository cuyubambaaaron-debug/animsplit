const express = require('express');
const router = express.Router();
const { query } = require('../db/database');
const { processingQueue, getProgress } = require('../services/queue');
const { getSignedDownloadUrl } = require('../services/storage');

// POST /api/videos — create video and start processing
// Body: { projectId, name, uploadId, frameKeys, elements }
// elements: [{ type, slotId, name, description, referenceImageUrl }]
router.post('/', async (req, res) => {
  try {
    const { projectId, name, uploadId, frameKeys, elements } = req.body;

    if (!projectId || !uploadId || !frameKeys?.length || !elements?.length) {
      return res.status(400).json({ error: 'projectId, uploadId, frameKeys and elements are required' });
    }

    // Create video record
    const { rows: [video] } = await query(`
      INSERT INTO videos (project_id, name, frame_count, status, upload_id)
      VALUES ($1, $2, $3, 'processing', $4)
      RETURNING *
    `, [projectId, name || `Video ${new Date().toLocaleDateString()}`, frameKeys.length, uploadId]);

    // Create element records and queue jobs
    for (const element of elements) {
      const { rows: [ve] } = await query(`
        INSERT INTO video_elements (video_id, element_type, element_name, slot_id, status)
        VALUES ($1, $2, $3, $4, 'queued')
        RETURNING *
      `, [video.id, element.type, element.name, element.slotId || null]);

      await query(`
        INSERT INTO processing_jobs (video_id, element_id, status, total_frames)
        VALUES ($1, $2, 'queued', $3)
      `, [video.id, ve.id, frameKeys.length]);

      await processingQueue.add('process-element', {
        videoId: video.id,
        elementId: ve.id,
        frameKeys,
        elementConfig: {
          name: element.name,
          description: element.description,
          referenceImageUrl: element.referenceImageUrl || null,
        }
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      });
    }

    res.status(201).json({ videoId: video.id, status: 'processing' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/videos/:id/status — video + element progress
router.get('/:id/status', async (req, res) => {
  try {
    const { rows: [video] } = await query('SELECT * FROM videos WHERE id = $1', [req.params.id]);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const { rows: elements } = await query(
      'SELECT * FROM video_elements WHERE video_id = $1',
      [req.params.id]
    );

    res.json({
      ...video,
      elements: elements.map(e => ({ ...e, progress: getProgress(e.id) }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/videos/project/:projectId — list videos for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM videos WHERE project_id = $1 ORDER BY created_at DESC',
      [req.params.projectId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/videos/:id/download-urls — signed download URLs for all output files
router.get('/:id/download-urls', async (req, res) => {
  try {
    const { rows: elements } = await query(
      `SELECT * FROM video_elements WHERE video_id = $1 AND status = 'completed'`,
      [req.params.id]
    );

    const result = [];
    for (const el of elements) {
      // Get signed URL for the whole output folder prefix
      // Client will receive folder path and can request individual files
      result.push({
        elementName: el.element_name,
        elementType: el.element_type,
        outputFolder: el.output_folder_url,
        framesProcessed: el.frames_processed,
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
