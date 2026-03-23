const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { uploadFile } = require('../services/storage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }
});

// POST /api/upload/frames — accepts multiple PNG/JPG files (folder upload)
router.post('/frames', upload.array('frames', 120), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: 'No files uploaded' });

    const images = req.files
      .filter(f => /\.(png|jpg|jpeg)$/i.test(f.originalname))
      .sort((a, b) => a.originalname.localeCompare(b.originalname));

    if (images.length === 0)
      return res.status(400).json({ error: 'No PNG/JPG images found in the folder' });
    if (images.length > 120)
      return res.status(400).json({ error: `Too many frames (${images.length}). Maximum is 120.` });

    const uploadId = uuidv4();
    const frameKeys = [];

    for (let i = 0; i < images.length; i++) {
      const frameNumber = String(i + 1).padStart(4, '0');
      const key = `uploads/${uploadId}/frame_${frameNumber}.png`;
      await uploadFile(key, images[i].buffer);
      frameKeys.push(key);
    }

    res.json({ uploadId, frameCount: frameKeys.length, frameKeys });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
