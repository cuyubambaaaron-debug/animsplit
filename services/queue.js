const Bull = require('bull');
const { query } = require('../db/database');
const { uploadFile, downloadFile } = require('./storage');
const { isolateElement, convertToLineart } = require('./imageProcessor');

const processingQueue = new Bull('video-processing', process.env.REDIS_URL);

// In-memory progress (per element ID)
const progressStore = {};

function getProgress(elementId) {
  return progressStore[elementId] || { status: 'unknown', current: 0, total: 0 };
}

processingQueue.process('process-element', 3, async (job) => {
  const { videoId, elementId, frameKeys, elementConfig } = job.data;

  progressStore[elementId] = { status: 'processing', current: 0, total: frameKeys.length };

  await query(`UPDATE video_elements SET status = 'processing' WHERE id = $1`, [elementId]);
  await query(`UPDATE processing_jobs SET status = 'processing', started_at = NOW() WHERE element_id = $1`, [elementId]);

  for (let i = 0; i < frameKeys.length; i++) {
    // Download original frame from R2
    const frameBuffer = await downloadFile(frameKeys[i]);

    // Step 1: Isolate element
    const isolated = await isolateElement(
      frameBuffer,
      elementConfig.referenceImageUrl,
      elementConfig.description
    );

    // Step 2: Convert to line art
    const lineart = await convertToLineart(isolated);

    // Upload result to R2
    const frameNumber = String(i + 1).padStart(4, '0');
    const outputKey = `outputs/${videoId}/${elementConfig.name}/frame_${frameNumber}.png`;
    await uploadFile(outputKey, lineart);

    // Update progress
    progressStore[elementId] = { status: 'processing', current: i + 1, total: frameKeys.length };
    job.progress(Math.round(((i + 1) / frameKeys.length) * 100));

    await query(
      `UPDATE video_elements SET frames_processed = $1 WHERE id = $2`,
      [i + 1, elementId]
    );
    await query(
      `UPDATE processing_jobs SET current_frame = $1 WHERE element_id = $2`,
      [i + 1, elementId]
    );
  }

  // Mark element complete
  progressStore[elementId] = { status: 'completed', current: frameKeys.length, total: frameKeys.length };

  await query(
    `UPDATE video_elements SET status = 'completed', output_folder_url = $1 WHERE id = $2`,
    [`outputs/${videoId}/${elementConfig.name}/`, elementId]
  );
  await query(
    `UPDATE processing_jobs SET status = 'completed', completed_at = NOW() WHERE element_id = $1`,
    [elementId]
  );

  // Check if all elements for this video are done
  const { rows } = await query(
    `SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'completed' THEN 1 END) as done
     FROM video_elements WHERE video_id = $1`,
    [videoId]
  );
  if (parseInt(rows[0].total) === parseInt(rows[0].done)) {
    await query(
      `UPDATE videos SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [videoId]
    );
  }

  return { elementId, framesProcessed: frameKeys.length };
});

processingQueue.on('failed', async (job, err) => {
  const { elementId } = job.data;
  progressStore[elementId] = { status: 'failed', error: err.message };
  await query(`UPDATE video_elements SET status = 'failed' WHERE id = $1`, [elementId]);
  await query(
    `UPDATE processing_jobs SET status = 'failed', error_message = $1 WHERE element_id = $2`,
    [err.message, elementId]
  );
});

module.exports = { processingQueue, getProgress };
