import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { videosApi, getDownloadUrl, getFrameKey } from '../api';
import Header from '../components/Header';

const POLL_MS = 3000;

export default function VideoStatus() {
  const { id } = useParams();
  const [video, setVideo]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [downloadData, setDownloadData] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const pollRef = useRef(null);
  const timelineRef = useRef(null);

  useEffect(() => {
    load();
    return () => clearInterval(pollRef.current);
  }, [id]);

  async function load() {
    try {
      const { data } = await videosApi.status(id);
      setVideo(data);
      setLoading(false);
      if (!selectedLayer && data.elements?.length) setSelectedLayer(data.elements[0].id);

      if (data.status === 'completed') {
        clearInterval(pollRef.current);
        fetchDownloads();
      } else if (data.status === 'processing') {
        clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          try {
            const { data: fresh } = await videosApi.status(id);
            setVideo(fresh);
            if (fresh.status === 'completed') {
              clearInterval(pollRef.current);
              fetchDownloads();
            } else if (fresh.status === 'failed') {
              clearInterval(pollRef.current);
            }
          } catch (e) { console.error(e); }
        }, POLL_MS);
      }
    } catch (e) { console.error(e); setLoading(false); }
  }

  async function fetchDownloads() {
    try {
      const { data } = await videosApi.downloadUrls(id);
      setDownloadData(data);
    } catch (e) { console.error(e); }
  }

  // Build a frame status array for a given element
  function buildFrameStatuses(el) {
    const total = video?.frame_count || 0;
    const done  = el.frames_processed || 0;
    const status = el.status;
    return Array.from({ length: total }, (_, i) => {
      if (i < done) return 'done';
      if (i === done && status === 'processing') return 'active';
      return 'pending';
    });
  }

  function overallPct() {
    if (!video?.elements?.length) return 0;
    const total = video.frame_count || 1;
    const sum = video.elements.reduce((acc, el) => acc + (el.frames_processed || 0), 0);
    return Math.round((sum / (total * video.elements.length)) * 100);
  }

  if (loading) return (
    <div className="min-h-screen bg-navy flex items-center justify-center text-muted text-sm">Loading…</div>
  );

  if (!video) return (
    <div className="min-h-screen bg-navy flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted mb-3">Video not found.</p>
        <Link to="/" className="text-cyan text-sm">← Go home</Link>
      </div>
    </div>
  );

  const isProcessing = video.status === 'processing';
  const isCompleted  = video.status === 'completed';
  const isFailed     = video.status === 'failed';
  const pct          = overallPct();

  return (
    <div className="min-h-screen bg-navy flex flex-col">
      <Header
        back={video.project_id ? `/project/${video.project_id}` : '/'}
        backLabel="Project"
        title={video.name}
        action={
          isProcessing && (
            <div className="flex items-center gap-2 text-xs text-cyan font-mono">
              <span className="animate-pulse w-2 h-2 rounded-full bg-cyan inline-block" />
              Live · {pct}%
            </div>
          )
        }
      />

      {/* ── STATUS BAR ─────────────────────────────────── */}
      <div className="bg-panel border-b border-border px-5 py-3 flex items-center gap-6">
        <StatusBadge status={video.status} />

        <div className="flex items-center gap-2 text-xs text-muted font-mono">
          <span className="text-white">{video.frame_count}</span> frames ·
          <span className="text-white">{video.elements?.length || 0}</span> layers
        </div>

        {/* Overall progress bar */}
        <div className="flex-1 max-w-xs">
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isCompleted ? 'bg-success' : 'bg-cyan'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── TIMELINE ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Timeline header + body */}
        <div className="flex flex-col flex-1 overflow-hidden m-4 bg-panel border border-border rounded-2xl">

          {/* Frame numbers header — sticky */}
          <div className="flex border-b border-border bg-panel/90 sticky top-0 z-10">
            {/* Layer label column */}
            <div className="w-48 shrink-0 px-4 py-2.5 border-r border-border">
              <span className="text-xs text-muted uppercase tracking-wider">Layer</span>
            </div>
            {/* Frame numbers */}
            <div className="flex-1 overflow-x-auto" ref={timelineRef}>
              <div className="flex gap-0.5 px-3 py-2 min-w-max">
                {Array.from({ length: video.frame_count }, (_, i) => (
                  <div
                    key={i}
                    className="w-7 text-center text-muted shrink-0"
                    style={{ fontSize: '9px' }}
                  >
                    {i % 10 === 0 ? String(i + 1).padStart(3, '0') : ''}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Layers */}
          <div className="flex-1 overflow-y-auto">
            {video.elements?.map((el, idx) => {
              const frames  = buildFrameStatuses(el);
              const isActive = selectedLayer === el.id;
              return (
                <div
                  key={el.id}
                  onClick={() => setSelectedLayer(el.id)}
                  className={`flex border-b border-border cursor-pointer transition-colors ${
                    isActive ? 'bg-cyan/5' : 'hover:bg-card'
                  }`}
                >
                  {/* Layer info */}
                  <div className={`w-48 shrink-0 px-4 py-3 border-r flex flex-col justify-center ${
                    isActive ? 'border-cyan/30' : 'border-border'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {el.element_type === 'character' ? '👤' : '🌄'}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-xs font-medium truncate ${isActive ? 'text-cyan' : 'text-white'}`}>
                          {el.element_name}
                        </p>
                        <p className="text-muted" style={{ fontSize: '10px' }}>
                          {el.frames_processed || 0} / {video.frame_count}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Frame cells */}
                  <div className="flex-1 overflow-x-auto">
                    <div className="flex gap-0.5 px-3 py-3 min-w-max items-center">
                      {frames.map((status, fi) => (
                        <FrameCell
                          key={fi}
                          status={status}
                          frameNum={fi + 1}
                          elementName={el.element_name}
                          videoId={id}
                          isCompleted={isCompleted}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {(!video.elements || video.elements.length === 0) && (
              <div className="text-center py-16 text-muted text-sm">No layers to show.</div>
            )}
          </div>
        </div>

        {/* ── DOWNLOAD PANEL (when done) ─────────────── */}
        {isCompleted && downloadData && (
          <div className="mx-4 mb-4 bg-panel border border-success/25 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-success text-sm">✓</span>
                <span className="text-white font-medium text-sm">Processing Complete</span>
              </div>
              <span className="text-muted text-xs">{downloadData.length} layer{downloadData.length !== 1 ? 's' : ''} ready</span>
            </div>

            <div className="p-5 space-y-4">
              {downloadData.map((el) => (
                <div key={el.elementName}>
                  <p className="text-white text-sm font-medium mb-2">
                    {el.elementType === 'character' ? '👤' : '🌄'} {el.elementName}
                    <span className="text-muted font-normal ml-2 text-xs">{el.framesProcessed} frames</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: el.framesProcessed }, (_, i) => {
                      const key = getFrameKey(id, el.elementName, i + 1);
                      const url = getDownloadUrl(key);
                      const num = String(i + 1).padStart(4, '0');
                      return (
                        <a
                          key={i}
                          href={url}
                          download={`${el.elementName}_${num}.png`}
                          className="bg-navy border border-border hover:border-cyan text-muted hover:text-cyan rounded-lg px-2 py-1 text-xs font-mono transition-all"
                          title={`Download frame ${num}`}
                        >
                          {num}
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
          <div className="mx-4 mb-4 bg-danger/10 border border-danger/25 rounded-2xl px-5 py-4 text-center">
            <p className="text-danger font-medium mb-2">Processing failed</p>
            <p className="text-muted text-sm">Check your layer descriptions and try again.</p>
            <Link
              to={`/project/${video.project_id}/upload`}
              className="mt-3 inline-block bg-cyan text-navy text-sm font-semibold px-5 py-2 rounded-xl hover:shadow-cyan transition-all"
            >
              Try Again
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────── */

function FrameCell({ status, frameNum, elementName, videoId, isCompleted }) {
  const cls = {
    done:    'frame-cell done',
    active:  'frame-cell active',
    pending: 'frame-cell pending',
    failed:  'frame-cell failed',
  }[status] || 'frame-cell pending';

  if (status === 'done' && isCompleted) {
    const key = getFrameKey(videoId, elementName, frameNum);
    const url = getDownloadUrl(key);
    return (
      <a
        href={url}
        download={`${elementName}_${String(frameNum).padStart(4,'0')}.png`}
        className={cls}
        title={`Download frame ${frameNum}`}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return <div className={cls} title={`Frame ${frameNum} — ${status}`} />;
}

function StatusBadge({ status }) {
  const map = {
    processing: { label: 'Processing', cls: 'text-cyan border-cyan/40 bg-cyan/10' },
    completed:  { label: 'Completed',  cls: 'text-success border-success/40 bg-success/10' },
    failed:     { label: 'Failed',     cls: 'text-danger border-danger/40 bg-danger/10' },
    pending:    { label: 'Pending',    cls: 'text-muted border-border bg-card' },
  };
  const { label, cls } = map[status] || map.pending;
  return (
    <span className={`text-xs font-medium px-3 py-1 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}
