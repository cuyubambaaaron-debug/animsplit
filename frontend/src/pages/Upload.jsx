import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsApi, uploadApi, videosApi } from '../api';
import Header from '../components/Header';
import ProgressBar from '../components/ProgressBar';

export default function Upload() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject]             = useState(null);
  const [step, setStep]                   = useState('upload');
  const [dragOver, setDragOver]           = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult]   = useState(null);
  const [elements, setElements]           = useState([]);
  const [videoName, setVideoName]         = useState('');
  const [starting, setStarting]           = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    projectsApi.get(projectId).then(({ data }) => {
      setProject(data);
      const els = [];
      data.characters?.forEach((s) =>
        els.push({ type: 'character', slotNumber: s.slot_number, slot: s, enabled: true })
      );
      data.backgrounds?.forEach((s) =>
        els.push({ type: 'background', slotNumber: s.slot_number, slot: s, enabled: true })
      );
      setElements(els);
      setVideoName(`Video ${new Date().toLocaleDateString()}`);
    });
  }, [projectId]);

  async function handleFile(file) {
    if (!file?.name.endsWith('.zip')) {
      alert('Please upload a ZIP file.'); return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const { data } = await uploadApi.frames(file, setUploadProgress);
      setUploadResult(data);
      setStep('configure');
    } catch (e) {
      alert('Upload error: ' + (e.response?.data?.error || e.message));
    } finally { setUploading(false); }
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function toggle(idx) {
    setElements((prev) => prev.map((el, i) => i === idx ? { ...el, enabled: !el.enabled } : el));
  }

  async function handleStart() {
    const active = elements.filter((e) => e.enabled).map((e) => ({
      type: e.type, slotId: e.slot.id, name: e.slot.name,
      description: e.slot.description || '',
      referenceImageUrl: e.slot.reference_image_url || null,
    }));
    if (!active.length) { alert('Select at least one layer.'); return; }
    setStarting(true);
    try {
      const { data } = await videosApi.create({
        projectId, name: videoName.trim(),
        uploadId: uploadResult.uploadId,
        frameKeys: uploadResult.frameKeys,
        elements: active,
      });
      navigate(`/video/${data.videoId}`);
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
      setStarting(false);
    }
  }

  const activeCount = elements.filter((e) => e.enabled).length;

  return (
    <div className="min-h-screen bg-navy">
      <Header back={`/project/${projectId}`} backLabel={project?.name || 'Project'} title="New Video" />

      <main className="max-w-2xl mx-auto px-5 py-10">
        {/* Steps */}
        <div className="flex items-center gap-3 mb-10">
          {['Upload', 'Configure', 'Process'].map((label, i) => {
            const steps = ['upload', 'configure', 'start'];
            const current = steps.indexOf(step);
            const done = current > i;
            const active = current === i;
            return (
              <div key={label} className="flex items-center gap-3">
                <div className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  active ? 'text-cyan' : done ? 'text-success' : 'text-muted'
                }`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${
                    active ? 'border-cyan text-cyan' :
                    done   ? 'border-success text-success bg-success/10' :
                             'border-border text-muted'
                  }`}>
                    {done ? '✓' : i + 1}
                  </span>
                  {label}
                </div>
                {i < 2 && <div className="w-8 h-px bg-border" />}
              </div>
            );
          })}
        </div>

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Upload Frames</h2>
            <p className="text-muted text-sm mb-6">
              Export your animation as PNG frames, ZIP them, drop here. Max 120 frames.
            </p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileRef.current.click()}
              className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all ${
                dragOver ? 'drop-active' : 'border-border hover:border-cyan/40 hover:bg-panel'
              }`}
            >
              {uploading ? (
                <div className="space-y-4">
                  <div className="text-4xl">⬆️</div>
                  <p className="text-white font-medium">Uploading…</p>
                  <ProgressBar value={uploadProgress} sublabel={`${uploadProgress}%`} />
                </div>
              ) : (
                <div>
                  <div className="text-5xl mb-4 opacity-60">📂</div>
                  <p className="text-white font-medium">Drop ZIP file here</p>
                  <p className="text-muted text-sm mt-1">or click to browse</p>
                  <p className="text-muted/50 text-xs mt-3">Accepts .zip with .png / .jpg frames</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".zip" className="hidden"
              onChange={(e) => handleFile(e.target.files[0])} />
          </div>
        )}

        {/* STEP 2: CONFIGURE */}
        {step === 'configure' && uploadResult && (
          <div>
            <div className="flex items-center gap-3 bg-success/10 border border-success/25 rounded-xl px-4 py-3 mb-7">
              <span className="text-success text-xl">✓</span>
              <div>
                <p className="text-success font-medium text-sm">{uploadResult.frameCount} frames uploaded</p>
                <p className="text-muted text-xs">Select layers to extract</p>
              </div>
            </div>

            <h2 className="text-xl font-bold text-white mb-1">Configure Layers</h2>
            <p className="text-muted text-sm mb-5">Choose which layers to extract from these frames.</p>

            {elements.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl text-muted text-sm">
                No layers configured in this project yet.
              </div>
            ) : (
              <div className="space-y-2 mb-6">
                {elements.map((el, i) => (
                  <label key={i} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                    el.enabled ? 'bg-panel border-cyan/30' : 'bg-panel/30 border-border opacity-50'
                  }`}>
                    <input type="checkbox" checked={el.enabled} onChange={() => toggle(i)}
                      className="accent-cyan w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">
                        {el.type === 'character' ? '👤' : '🌄'} {el.slot.name}
                      </p>
                      {el.slot.description && (
                        <p className="text-muted text-xs mt-0.5 line-clamp-1">{el.slot.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted capitalize bg-border px-2 py-0.5 rounded-full">
                      {el.type}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-xs text-muted uppercase tracking-wider mb-1.5">Video Name</label>
              <input
                className="w-full bg-navy border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan transition-colors"
                value={videoName}
                onChange={(e) => setVideoName(e.target.value)}
              />
            </div>

            <button
              onClick={handleStart}
              disabled={starting || activeCount === 0}
              className="w-full bg-cyan text-navy py-3.5 rounded-xl font-bold text-base transition-all hover:shadow-cyan disabled:opacity-40"
            >
              {starting ? 'Starting…' : `🚀 Process ${activeCount} layer${activeCount !== 1 ? 's' : ''} × ${uploadResult.frameCount} frames`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
