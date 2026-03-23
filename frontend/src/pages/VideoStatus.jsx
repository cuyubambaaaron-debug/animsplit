import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { videosApi, getDownloadUrl, getFrameKey } from '../api';
import Header from '../components/Header';
import ProgressBar from '../components/ProgressBar';

const POLL_INTERVAL = 3000;

export default function VideoStatus() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadData, setDownloadData] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadStatus();
    return () => clearInterval(pollRef.current);
  }, [id]);

  async function loadStatus() {
    try {
      const { data } = await videosApi.status(id);
      setVideo(data);
      setLoading(false);

      if (data.status === 'completed') {
        clearInterval(pollRef.current);
        loadDownloadUrls();
      } else if (data.status === 'processing') {
        clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          try {
            const { data: fresh } = await videosApi.status(id);
            setVideo(fresh);
            if (fresh.status === 'completed' || fresh.status === 'failed') {
              clearInterval(pollRef.current);
              if (fresh.status === 'completed') loadDownloadUrls();
            }
          } catch (e) {
            console.error(e);
          }
        }, POLL_INTERVAL);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  async function loadDownloadUrls() {
    try {
      const { data } = await videosApi.downloadUrls(id);
      setDownloadData(data);
    } catch (e) {
      console.error(e);
    }
  }

  function getElementProgress(el) {
    const prog = el.progress || {};
    if (prog.status === 'completed') return 100;
    if (prog.total > 0) return Math.round((prog.current / prog.total) * 100);
    return 0;
  }

  function elementStatusLabel(el) {
    const s = el.status;
    if (s === 'completed') return { label: 'Done', color: 'text-success' };
    if (s === 'processing') return { label: 'Processing…', color: 'text-warning' };
    if (s === 'failed') return { label: 'Failed', color: 'text-danger' };
    return { label: 'Queued', color: 'text-slate-500' };
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">Video not found.</p>
          <Link to="/" className="text-accent mt-2 inline-block">← Go home</Link>
        </div>
      </div>
    );
  }

  const isProcessing = video.status === 'processing';
  const isCompleted = video.status === 'completed';
  const isFailed = video.status === 'failed';

  const overallProgress = video.elements?.length > 0
    ? video.elements.reduce((sum, el) => sum + getElementProgress(el), 0) / video.elements.length
    : 0;

  return (
    <div className="min-h-screen">
      <Header
        back={video.project_id ? `/project/${video.project_id}` : '/'}
        backLabel="Project"
        title={video.name}
      />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Status banner */}
        <div className={`rounded-2xl p-6 mb-8 border ${
          isCompleted ? 'bg-success/10 border-success/30' :
          isFailed   ? 'bg-danger/10 border-danger/30' :
                       'bg-card border-border'
        }`}>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl">
              {isCompleted ? '✅' : isFailed ? '❌' : '⚙️'}
            </div>
            <div className="flex-1">
              <h2 className="text-white font-bold text-xl">
                {isCompleted ? 'Processing Complete!' :
                 isFailed    ? 'Processing Failed' :
                               'Processing Frames…'}
              </h2>
              <p className="text-slate-400 text-sm mt-0.5">
                {video.frame_count} frames ·{' '}
                {video.elements?.length || 0} element{video.elements?.length !== 1 ? 's' : ''}
                {isProcessing && ' · Auto-refreshing every 3s'}
              </p>
            </div>
            {isProcessing && (
              <div className="animate-spin text-accent text-2xl">⟳</div>
            )}
          </div>

          {isProcessing && (
            <ProgressBar
              value={overallProgress}
              label="Overall progress"
              sublabel={`${Math.round(overallProgress)}%`}
            />
          )}
        </div>

        {/* Per-element progress */}
        <div className="space-y-4 mb-8">
          <h3 className="text-white font-semibold">Elements</h3>
          {video.elements?.map((el) => {
            const { label, color } = elementStatusLabel(el);
            const pct = getElementProgress(el);
            return (
              <div key={el.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white font-medium">
                      {el.element_type === 'character' ? '👤' : '🌄'} {el.element_name}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5 capitalize">{el.element_type}</p>
                  </div>
                  <span className={`text-sm font-medium ${color}`}>{label}</span>
                </div>
                <ProgressBar
                  value={pct}
                  sublabel={
                    el.frames_processed > 0
                      ? `${el.frames_processed} / ${video.frame_count} frames`
                      : label
                  }
                  color={el.status === 'completed' ? 'success' : el.status === 'failed' ? 'danger' : 'accent'}
                />
              </div>
            );
          })}
        </div>

        {/* ── RESULTS ─────────────────────────────────────────── */}
        {isCompleted && downloadData && (
          <div>
            <h3 className="text-white font-semibold mb-4">📥 Download Results</h3>
            <div className="space-y-4">
              {downloadData.map((el) => (
                <div key={el.elementName} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-white font-medium">
                        {el.elementType === 'character' ? '👤' : '🌄'} {el.elementName}
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {el.framesProcessed} frames processed
                      </p>
                    </div>
                  </div>

                  {/* Frame download grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {Array.from({ length: el.framesProcessed }, (_, i) => {
                      const frameNum = String(i + 1).padStart(4, '0');
                      const key = getFrameKey(id, el.elementName, i + 1);
                      const url = getDownloadUrl(key);
                      return (
                        <a
                          key={i}
                          href={url}
                          download={`${el.elementName}_frame_${frameNum}.png`}
                          className="bg-surface border border-border hover:border-accent rounded-lg p-2 text-center text-xs text-slate-400 hover:text-accent transition-all"
                          title={`Frame ${i + 1}`}
                        >
                          <div className="text-lg mb-0.5">🖼️</div>
                          {frameNum}
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isFailed && (
          <div className="text-center py-8">
            <p className="text-slate-400 mb-4">
              Something went wrong during processing. Check your slot descriptions and try again.
            </p>
            <Link
              to={`/project/${video.project_id}/upload`}
              className="bg-accent hover:bg-accent-light text-white px-6 py-2.5 rounded-lg font-medium transition-colors inline-block"
            >
              Try Again
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
