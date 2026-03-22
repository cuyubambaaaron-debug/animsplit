const axios = require('axios');

// Pluggable image processor — swap API here when ready
// Currently returns mock output (original frame) until API key is set

async function isolateElement(imageBuffer, referenceImageUrl, elementDescription) {
  if (!process.env.REPLICATE_API_TOKEN) {
    console.log(`[MOCK] Isolate: ${elementDescription}`);
    return imageBuffer;
  }

  const prediction = await axios.post(
    'https://api.replicate.com/v1/predictions',
    {
      version: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
      input: {
        image: `data:image/png;base64,${imageBuffer.toString('base64')}`,
        prompt: `Isolate only ${elementDescription}. Remove all other elements. White solid background. Keep exact shape and position.`,
        negative_prompt: 'blur, artifacts, distortion, extra elements',
        num_inference_steps: 20,
        strength: 0.7,
      }
    },
    { headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' } }
  );

  return await pollResult(prediction.data.urls.get);
}

async function convertToLineart(imageBuffer) {
  if (!process.env.REPLICATE_API_TOKEN) {
    console.log('[MOCK] Lineart conversion');
    return imageBuffer;
  }

  const prediction = await axios.post(
    'https://api.replicate.com/v1/predictions',
    {
      version: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
      input: {
        image: `data:image/png;base64,${imageBuffer.toString('base64')}`,
        prompt: 'Clean black line art, anime style, transparent background, no color, no fill, sharp outlines only',
        negative_prompt: 'color, fill, shadow, blur, background',
        num_inference_steps: 20,
        strength: 0.8,
      }
    },
    { headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' } }
  );

  return await pollResult(prediction.data.urls.get);
}

async function pollResult(statusUrl, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const { data } = await axios.get(statusUrl, {
      headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` }
    });

    if (data.status === 'succeeded') {
      const outputUrl = Array.isArray(data.output) ? data.output[0] : data.output;
      const imgRes = await axios.get(outputUrl, { responseType: 'arraybuffer' });
      return Buffer.from(imgRes.data);
    }
    if (data.status === 'failed') {
      throw new Error(`Replicate error: ${data.error}`);
    }
  }
  throw new Error('Timeout waiting for Replicate result');
}

module.exports = { isolateElement, convertToLineart };
