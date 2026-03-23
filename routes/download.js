const express = require('express');
const router = express.Router();
const { getSignedDownloadUrl } = require('../services/storage');

// GET /api/download?key=outputs/...
// Returns a redirect to a signed R2 URL for the given key
router.get('/', async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'key is required' });

  // Basic path traversal guard
  if (key.includes('..')) return res.status(400).json({ error: 'Invalid key' });

  try {
    const url = await getSignedDownloadUrl(key, 3600);
    res.redirect(url);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
