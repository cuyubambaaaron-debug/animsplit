import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsApi, uploadApi, videosApi } from '../api';
import Header from '../components/Header';
import ProgressBar from '../components/ProgressBar';

const STEPS = ['upload', 'configure', 'start'];

export default function Upload() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [step, setStep] = useState('upload');

  // Step 1: upload
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null); // { uploadId, frameCount, frameKeys }
  const fileRef = useRef();

  // Step 2: configure
  const [selectedElements, setSelectedElements] = useState([]); // [{ type, slotNumber, slot, enabled }]
  const [videoName, setVideoName] = useState('');

  // Step 3: start
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    projectsApi.get(projectId).then(({ data }) => {
      setProject(data);
      // Pre-populate element list from configured slots
      const elements = [];
      data.characters?.forEach((s) =>
        elements.push({ type: 'character', slotNumber: s.slot_number, slot: s, enabled: true })
      );
      data.backgrounds?.forEach((s) =>
        elements.push({ type: 'background', slotNumber: s.slot_number, slot: s, enabled: true })
      );
      setSelectedElements(elements);
      setVideoName(`Video ${new Date().toLocaleDateString()}`);
    });
  }, [projectId]);

  async function handleFile(file) {
    if (!file || !file.name.endsWith('.zip')) {
      alert('Please upload a ZIP file containing PNG frames.');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const { data } = await uploadApi.frames(file, setUploadProgress);
      setUploadResult(data);
      setStep('configure');
    } catch (e) {
      alert('Upload error: ' + (e.response?.data?.error || e.message));
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function toggleElement(idx) {
    setSelectedElements((prev) =>
      prev.map((el, i) => (i === idx ? { ...el, enabled: !el.enabled } : el))
    );
  }

  async function handleStart() {
    const elements = selectedElements
      .filter((el) => el.enabled)
      .map((el) => ({
        type: el.type,
        slotId: el.slot.id,
        name: el.slot.name,
        description: el.slot.description || '',
        referenceImageUrl: el.slot.reference_image_url || null,
      }));

    if (elements.length === 0) {
      alert('Select at least one element to extract.');
      return;
    }

    setStarting(true);
    try {
      const { data } = await videosApi.create({
        projectId,
        name: videoName.trim() || `Video ${new Date().toLocaleDateString()}`,
        uploadId: uploadResult.uploadId,
        frameKeys: uploadResult.frameKeys,
        elements,
      });
      navigate(`/video/${data.videoId}`);
    } catch (e) {
      alert('Error starting: ' + (e.response?.data?.error || e.message));
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Header
        back={`/project/${projectId}`}
        backLabel={project?.name || 'Project'}
        title="New Video"
      />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { key: 'upload', label: '1. Upload' },
            { key: 'configure', label: '2. Configure' },
            { key: 'start', label: '3. Start' },
          ].map(({ key, label }, i) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className={`text-sm font-medium transition-colors ${
                  step === key ? 'text-accent-light' : STEPS.indexOf(step) > i ? 'text-success' : 'text-slate-600'
                }`}
              >
                {STEPS.indexOf(step) > i ? '✓ ' : ''}{label}
              </span>
              {i < 2 && <span className="text-slate-700">→</span>}
            </div>
          ))}
        </div>

        {/* ── STEP 1: UPLOAD ──────────────────────────────────── */}
        {step === 'upload' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Upload Frames</h2>
            <p className="text-slate-400 text-sm mb-6">
              Export your animation as PNG frames, compress them into a ZIP, and upload here.
              Maximum 120 frames.
            </p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileRef.current.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:border-accent/50 hover:bg-card'
              }`}
            >
              {uploading ? (
                <div className="space-y-4">
                  <div className="text-4xl">⬆️</div>
                  <p className="text-white font-medium">Uploading frames…</p>
                  <ProgressBar value={uploadProgress} sublabel={`${uploadProgress}%`} />
                </div>
              ) : (
                <div>
                  <div className="text-5xl mb-4">📁</div>
                  <p className="text-white font-medium">Drop your ZIP file here</p>
                  <p className="text-slate-500 text-sm mt-1">or click to browse</p>
                  <p className="text-slate-600 text-xs mt-3">Accepted: .zip containing .png / .jpg frames</p>
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        )}

        {/* ── STEP 2: CONFIGURE ───────────────────────────────── */}
        {step === 'configure' && uploadResult && (
          <div>
            <div className="bg-success/10 border border-success/30 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-success font-medium">
                  {uploadResult.frameCount} frames uploaded
                </p>
                <p className="text-slate-400 text-xs">Ready to configure extraction</p>
              </div>
            </div>

            <h2 className="text-xl font-bold text-white mb-1">Configure Extraction</h2>
            <p className="text-slate-400 text-sm mb-5">
              Choose which characters and backgrounds to extract from these frames.
            </p>

            {selectedElements.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl">
                <p className="text-slate-400">No slots configured in this project.</p>
                <p className="text-slate-500 text-sm mt-1">
                  Go back and add character/background slots first.
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {selectedElements.map((el, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                      el.enabled
                        ? 'bg-card border-accent/50'
                        : 'bg-card/30 border-border opacity-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={el.enabled}
                      onChange={() => toggleElement(i)}
                      className="accent-accent w-4 h-4 rounded"
                    />
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">
                        {el.type === 'character' ? '👤' : '🌄'} {el.slot.name}
                      </p>
                      {el.slot.description && (
                        <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">
                          {el.slot.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-600 capitalize">{el.type}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-1">Video Name</label>
              <input
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent"
                value={videoName}
                onChange={(e) => setVideoName(e.target.value)}
              />
            </div>

            <button
              onClick={handleStart}
              disabled={starting || selectedElements.filter((e) => e.enabled).length === 0}
              className="w-full bg-accent hover:bg-accent-light text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 text-lg"
            >
              {starting ? 'Starting…' : `🚀 Start Processing (${selectedElements.filter((e) => e.enabled).length} elements)`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
