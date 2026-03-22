const sharp = require('sharp');

async function getPixelData(buffer) {
  const { data } = await sharp(buffer)
    .resize(32, 32, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

async function compareImages(buffer1, buffer2) {
  const [data1, data2] = await Promise.all([getPixelData(buffer1), getPixelData(buffer2)]);
  let diff = 0;
  for (let i = 0; i < data1.length; i++) {
    diff += Math.abs(data1[i] - data2[i]);
  }
  const maxDiff = data1.length * 255;
  return ((maxDiff - diff) / maxDiff) * 100;
}

async function detectStrategy(frameBuffers) {
  if (frameBuffers.length <= 1) {
    return { strategy: 'static', uniqueIndices: [0] };
  }

  // Sample 4 points across the sequence
  const sampleIndices = [
    0,
    Math.floor(frameBuffers.length * 0.33),
    Math.floor(frameBuffers.length * 0.66),
    frameBuffers.length - 1
  ];

  let totalSimilarity = 0;
  for (let i = 0; i < sampleIndices.length - 1; i++) {
    totalSimilarity += await compareImages(
      frameBuffers[sampleIndices[i]],
      frameBuffers[sampleIndices[i + 1]]
    );
  }
  const avg = totalSimilarity / (sampleIndices.length - 1);

  if (avg > 98) {
    return { strategy: 'static', uniqueIndices: [0] };
  }

  if (avg > 85) {
    const uniqueIndices = [0];
    for (let i = 1; i < frameBuffers.length; i++) {
      const sim = await compareImages(frameBuffers[i - 1], frameBuffers[i]);
      if (sim < 95) uniqueIndices.push(i);
    }
    return { strategy: 'partial', uniqueIndices };
  }

  return {
    strategy: 'full',
    uniqueIndices: frameBuffers.map((_, i) => i)
  };
}

module.exports = { detectStrategy, compareImages };
