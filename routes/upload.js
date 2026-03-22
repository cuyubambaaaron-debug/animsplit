const express = require('express');
const router = express.Router();
const multer = require('multer');
const AdmZip = require('adm-zip');
const { v4: uuidv4 } = require('uuid');
const { uploadFile } = require('../services/storage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }
});

// POST /api/upload/frames — accepts ZIP of PNG frames
router.post('/frames', upload.single('frames'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const isZip = req.file.mimetype === 'application/zip'
      || req.file.mimetype === 'application/x-zip-compressed'
      || req.file.originalname.endsWith('.zip');

    if (!isZip) {
      return res.status(400).json({ error: 'Please upload a ZIP file containing PNG frames' });
    }

    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries()
      .filter(e => !e.isDirectory && /\.(png|jpg|jpeg)$/i.test(e.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (entries.length === 0) {
      return res.status(400).json({ error: 'No PNG/JPG images found in ZIP' });
    }
    if (entries.length > 120) {
      return res.status(400).json({ error: `Too many frames (${entries.length}). Maximum is 120.` });
    }

    const uploadId = uuidv4();
    const frameKeys = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const buffer = entry.getData();
      const frameNumber = String(i + 1).padStart(4, '0');
      const key = `uploads/${uploadId}/frame_${frameNumber}.png`;
      await uploadFile(key, buffer);
      frameKeys.push(key);
    }

    res.json({
      uploadId,
      frameCount: frameKeys.length,
      frameKeys
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
