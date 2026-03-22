const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'animsplit-api' });
});

app.listen(PORT, () => {
  console.log(`AnimSplit API running on port ${PORT}`);
});
