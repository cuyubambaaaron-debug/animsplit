import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: () => api.get('/api/projects'),
  get: (id) => api.get(`/api/projects/${id}`),
  create: (name) => api.post('/api/projects', { name }),
  update: (id, name) => api.patch(`/api/projects/${id}`, { name }),
  delete: (id) => api.delete(`/api/projects/${id}`),
};

// ─── Slots ────────────────────────────────────────────────────────────────────
export const slotsApi = {
  updateCharacter: (projectId, slotNumber, { name, description, reference }) => {
    const fd = new FormData();
    if (name) fd.append('name', name);
    if (description) fd.append('description', description);
    if (reference) fd.append('reference', reference);
    return api.put(`/api/slots/characters/${projectId}/${slotNumber}`, fd);
  },
  updateBackground: (projectId, slotNumber, { name, description, reference }) => {
    const fd = new FormData();
    if (name) fd.append('name', name);
    if (description) fd.append('description', description);
    if (reference) fd.append('reference', reference);
    return api.put(`/api/slots/backgrounds/${projectId}/${slotNumber}`, fd);
  },
  deleteCharacter: (projectId, slotNumber) =>
    api.delete(`/api/slots/characters/${projectId}/${slotNumber}`),
  deleteBackground: (projectId, slotNumber) =>
    api.delete(`/api/slots/backgrounds/${projectId}/${slotNumber}`),
};

// ─── Upload ───────────────────────────────────────────────────────────────────
export const uploadApi = {
  frames: (file, onProgress) => {
    const fd = new FormData();
    fd.append('frames', file);
    return api.post('/api/upload/frames', fd, {
      onUploadProgress: (e) =>
        onProgress && onProgress(Math.round((e.loaded / e.total) * 100)),
    });
  },
};

// ─── Videos ───────────────────────────────────────────────────────────────────
export const videosApi = {
  create: (data) => api.post('/api/videos', data),
  status: (id) => api.get(`/api/videos/${id}/status`),
  listByProject: (projectId) => api.get(`/api/videos/project/${projectId}`),
  downloadUrls: (id) => api.get(`/api/videos/${id}/download-urls`),
};

// ─── Download helpers ─────────────────────────────────────────────────────────
export function getDownloadUrl(key) {
  const base = import.meta.env.VITE_API_URL || '';
  return `${base}/api/download?key=${encodeURIComponent(key)}`;
}

export function getFrameKey(videoId, elementName, frameNumber) {
  const frame = String(frameNumber).padStart(4, '0');
  return `outputs/${videoId}/${elementName}/frame_${frame}.png`;
}
