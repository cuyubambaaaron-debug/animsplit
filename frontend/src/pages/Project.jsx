import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, slotsApi } from '../api';
import SlotModal from '../components/SlotModal';

const MAX_SLOTS    = 5;
const FRAME_W      = 40;   // px per frame
const ROW_H        = 36;   // px per timeline row
const NAME_COL     = 190;  // px for layer name column
const TOTAL_FRAMES = 48;   // visible frames

// ─── Helpers ───────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export default function Project() {
  const { id } = useParams();
  const [project, setProject]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(null);
  const [editingName, setEditingName]   = useState(false);
  const [nameInput, setNameInput]       = useState('');

  // Timeline state
  const [currentFrame, setCurrentFrame] = useState(1);
  const [selectedClip, setSelectedClip] = useState(null); // { layerId, clipId }
  const [clips, setClips]               = useState({});   // { layerId: [{id,start,duration,imageUrl}] }

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      const { data } = await projectsApi.get(id);
      setProject(data);
      setNameInput(data.name);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function saveName() {
    if (!nameInput.trim() || nameInput === project.name) { setEditingName(false); return; }
    await projectsApi.update(id, nameInput.trim());
    setProject(p => ({ ...p, name: nameInput.trim() }));
    setEditingName(false);
  }

  async function handleSave(formData) {
    const { type, slotNumber } = modal;
    if (type === 'character') await slotsApi.updateCharacter(id, slotNumber, formData);
    else await slotsApi.updateBackground(id, slotNumber, formData);
    await load();
    setModal(null);
  }

  async function handleDelete(type, num) {
    if (!confirm('Remove layer?')) return;
    if (type === 'character') await slotsApi.deleteCharacter(id, num);
    else await slotsApi.deleteBackground(id, num);
    await load();
  }

  function getSlot(type, n) {
    return (type === 'character' ? project?.characters : project?.backgrounds)?.find(s => s.slot_number === n) || null;
  }
  function usedCount(type) {
    return ((type === 'character' ? project?.characters : project?.backgrounds) || []).length;
  }
  function nextFree(type) {
    const used = (type === 'character' ? project?.characters : project?.backgrounds) || [];
    for (let i = 1; i <= MAX_SLOTS; i++) if (!used.find(s => s.slot_number === i)) return i;
    return null;
  }

  // Clip operations
  function addClip(layerId, atFrame) {
    setClips(prev => {
      const existing = prev[layerId] || [];
      const occupied = existing.some(c => atFrame >= c.start && atFrame < c.start + c.duration);
      if (occupied) return prev;
      return { ...prev, [layerId]: [...existing, { id: uid(), start: atFrame, duration: 3, imageUrl: null }] };
    });
  }

  function updateClip(layerId, clipId, patch) {
    setClips(prev => ({
      ...prev,
      [layerId]: (prev[layerId] || []).map(c => c.id === clipId ? { ...c, ...patch } : c)
    }));
  }

  function deleteClip(layerId, clipId) {
    setClips(prev => ({ ...prev, [layerId]: (prev[layerId] || []).filter(c => c.id !== clipId) }));
    if (selectedClip?.layerId === layerId && selectedClip?.clipId === clipId) setSelectedClip(null);
  }

  // Get current canvas image
  function getCurrentImage() {
    if (!selectedClip) return null;
    const layerClips = clips[selectedClip.layerId] || [];
    const clip = layerClips.find(c => c.id === selectedClip.clipId);
    return clip?.imageUrl || null;
  }

  function getClipAtFrame(layerId, frame) {
    return (clips[layerId] || []).find(c => frame >= c.start && frame < c.start + c.duration);
  }

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#e8eaed', fontFamily:'Inter,sans-serif', color:'#888' }}>Loading…</div>
  );

  const charSlots = Array.from({ length: MAX_SLOTS }, (_, i) => i+1).filter(n => getSlot('character', n));
  const bgSlots   = Array.from({ length: MAX_SLOTS }, (_, i) => i+1).filter(n => getSlot('background', n));

  const timelineLayers = [
    { id:'base',     type:'base',       label:'BASE',                        color:'#818cf8' },
    ...(charSlots.length > 0
      ? charSlots.map(n => ({ id:`char-${n}`, type:'character', num:n, label:getSlot('character',n)?.name, color:'#38bdf8', slot:getSlot('character',n) }))
      : [{ id:'char-empty', type:'character', num:null, label:'+ Add Character', color:'#38bdf8', isEmpty:true }]
    ),
    ...(bgSlots.length > 0
      ? bgSlots.map(n => ({ id:`bg-${n}`, type:'background', num:n, label:getSlot('background',n)?.name, color:'#34d399', slot:getSlot('background',n) }))
      : [{ id:'bg-empty', type:'background', num:null, label:'+ Add Background', color:'#34d399', isEmpty:true }]
    ),
  ];

  const canvasImage = getCurrentImage();
  const selLayer = selectedClip ? timelineLayers.find(l => l.id === selectedClip.layerId) : null;
  const activeClipOnFrame = selLayer ? getClipAtFrame(selLayer.id, currentFrame) : null;

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', fontFamily:'Inter,system-ui,sans-serif', overflow:'hidden', color:'#1e293b', background:'#d1d5db' }}>

      {/* ══ TOP BAR ══════════════════════════════════════ */}
      <div style={{ height:'46px', background:'#1e293b', display:'flex', alignItems:'center', paddingInline:'16px', gap:'12px', flexShrink:0 }}>
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:'8px', textDecoration:'none' }}>
          <span style={{ fontSize:'18px' }}>🎬</span>
          <span style={{ fontWeight:800, fontSize:'13px', color:'#fff' }}>
            Macrometro <span style={{ color:'#38bdf8' }}>Animation</span>
          </span>
        </Link>
        <span style={{ width:'1px', height:'16px', background:'#334155' }}/>
        {editingName
          ? <input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)}
              onBlur={saveName} onKeyDown={e => e.key === 'Enter' && saveName()}
              style={{ background:'transparent', border:'none', borderBottom:'1px solid #38bdf8', outline:'none', color:'#fff', fontWeight:600, fontSize:'13px', width:'180px' }}/>
          : <button onClick={() => setEditingName(true)}
              style={{ background:'none', border:'none', color:'#e2e8f0', fontWeight:600, fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', padding:0 }}>
              {project.name} <span style={{ color:'#475569', fontSize:'11px' }}>✏</span>
            </button>
        }
        {/* Frame counter */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{ color:'#94a3b8', fontSize:'12px', fontFamily:'monospace' }}>
            Frame <span style={{ color:'#38bdf8', fontWeight:700 }}>{String(currentFrame).padStart(3,'0')}</span>
          </span>
          <Link to={`/project/${id}/upload`}
            style={{ background:'#38bdf8', color:'#fff', fontWeight:700, fontSize:'12px', padding:'6px 16px', borderRadius:'7px', textDecoration:'none', boxShadow:'0 0 12px rgba(56,189,248,0.4)' }}>
            ▶ Upload & Process
          </Link>
        </div>
      </div>

      {/* ══ CANVAS ═══════════════════════════════════════ */}
      <div style={{ flex:1, background:'#9ca3af', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', minHeight:0, position:'relative' }}>
        {/* 16:9 white canvas */}
        <div style={{
          background:'#ffffff', boxShadow:'0 8px 40px rgba(0,0,0,0.35)', borderRadius:'2px',
          aspectRatio:'16/9', maxHeight:'100%', maxWidth:'100%',
          width:'min(100%, calc((100vh - 46px - 200px) * 16/9))',
          display:'flex', alignItems:'center', justifyContent:'center',
          position:'relative', overflow:'hidden',
        }}>
          {/* Grid */}
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(#f1f5f9 1px,transparent 1px),linear-gradient(90deg,#f1f5f9 1px,transparent 1px)', backgroundSize:'80px 80px' }}/>

          {canvasImage ? (
            <img src={canvasImage} alt="frame" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', position:'relative', zIndex:1 }}/>
          ) : (
            <div style={{ position:'relative', zIndex:1, textAlign:'center', padding:'20px' }}>
              <p style={{ color:'#cbd5e1', fontSize:'11px', fontFamily:'monospace', marginBottom:'8px', letterSpacing:'0.1em' }}>1920 × 1080</p>
              <p style={{ color:'#94a3b8', fontSize:'14px', fontWeight:600, marginBottom:'4px' }}>
                {selLayer && !selLayer.isEmpty ? selLayer.label : project.name}
              </p>
              <p style={{ color:'#cbd5e1', fontSize:'12px' }}>
                {selLayer && !selLayer.isEmpty
                  ? 'Double-click a frame cell to add content'
                  : 'Configure layers in the timeline below'}
              </p>
            </div>
          )}

          {/* Frame badge */}
          <div style={{ position:'absolute', bottom:'8px', right:'10px', background:'rgba(0,0,0,0.08)', borderRadius:'4px', padding:'2px 7px', fontSize:'10px', color:'#94a3b8', fontFamily:'monospace' }}>
            {String(currentFrame).padStart(4,'0')}
          </div>
        </div>
      </div>

      {/* ══ TIMELINE ═════════════════════════════════════ */}
      <div style={{ background:'#0f172a', flexShrink:0, borderTop:'2px solid #020617', userSelect:'none' }}>

        {/* Header: layer col + frame numbers */}
        <div style={{ height:'28px', background:'#020617', display:'flex', alignItems:'stretch', borderBottom:'1px solid #1e293b' }}>
          <div style={{ width:`${NAME_COL}px`, flexShrink:0, borderRight:'1px solid #1e293b', display:'flex', alignItems:'center', justifyContent:'space-between', paddingInline:'10px' }}>
            <span style={{ color:'#334155', fontSize:'10px', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>Layers</span>
            <div style={{ display:'flex', gap:'4px' }}>
              {usedCount('character') < MAX_SLOTS &&
                <button onClick={() => { const n=nextFree('character'); if(n) setModal({type:'character',slotNumber:n,slot:null}); }}
                  style={{ background:'rgba(56,189,248,0.15)', border:'1px solid rgba(56,189,248,0.3)', color:'#38bdf8', fontSize:'10px', fontWeight:700, padding:'1px 7px', borderRadius:'4px', cursor:'pointer' }}>
                  👤+
                </button>
              }
              {usedCount('background') < MAX_SLOTS &&
                <button onClick={() => { const n=nextFree('background'); if(n) setModal({type:'background',slotNumber:n,slot:null}); }}
                  style={{ background:'rgba(52,211,153,0.15)', border:'1px solid rgba(52,211,153,0.3)', color:'#34d399', fontSize:'10px', fontWeight:700, padding:'1px 7px', borderRadius:'4px', cursor:'pointer' }}>
                  🌄+
                </button>
              }
            </div>
          </div>
          {/* Frame ruler */}
          <FrameRuler totalFrames={TOTAL_FRAMES} frameW={FRAME_W} currentFrame={currentFrame} onFrameClick={setCurrentFrame}/>
        </div>

        {/* Layer rows */}
        <div style={{ maxHeight:'160px', overflowY:'auto' }}>
          {timelineLayers.map(layer => (
            <TimelineRow
              key={layer.id}
              layer={layer}
              frameW={FRAME_W}
              rowH={ROW_H}
              nameColW={NAME_COL}
              totalFrames={TOTAL_FRAMES}
              clips={clips[layer.id] || []}
              currentFrame={currentFrame}
              selectedClipId={selectedClip?.layerId === layer.id ? selectedClip?.clipId : null}
              onFrameClick={f => { setCurrentFrame(f); }}
              onClipSelect={clipId => setSelectedClip({ layerId:layer.id, clipId })}
              onClipAdd={frame => addClip(layer.id, frame)}
              onClipUpdate={(clipId, patch) => updateClip(layer.id, clipId, patch)}
              onClipDelete={clipId => deleteClip(layer.id, clipId)}
              onLayerClick={() => {
                if (layer.isEmpty) {
                  const n = nextFree(layer.type);
                  if (n) setModal({ type:layer.type, slotNumber:n, slot:null });
                }
              }}
              onLayerEdit={() => layer.slot && setModal({ type:layer.type, slotNumber:layer.num, slot:layer.slot })}
              onLayerDelete={() => layer.slot && handleDelete(layer.type, layer.num)}
            />
          ))}
        </div>
      </div>

      {modal && <SlotModal slot={modal.slot} slotType={modal.type} onSave={handleSave} onClose={() => setModal(null)}/>}
    </div>
  );
}

/* ── Frame Ruler ──────────────────────────────────────────── */
function FrameRuler({ totalFrames, frameW, currentFrame, onFrameClick }) {
  return (
    <div style={{ flex:1, overflowX:'auto', display:'flex', alignItems:'center', cursor:'pointer', position:'relative' }}
      onClick={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const f = clamp(Math.floor((e.clientX - rect.left) / frameW) + 1, 1, totalFrames);
        onFrameClick(f);
      }}>
      {Array.from({ length: totalFrames }, (_, i) => (
        <div key={i} style={{
          width:`${frameW}px`, flexShrink:0, textAlign:'center', fontSize:'9px',
          fontFamily:'monospace', color: i+1 === currentFrame ? '#38bdf8' : '#334155',
          fontWeight: i+1 === currentFrame ? 700 : 400,
          borderLeft: i % 5 === 0 ? '1px solid #1e293b' : 'none',
          paddingTop:'2px',
        }}>
          {i % 5 === 0 ? String(i+1).padStart(2,'0') : ''}
        </div>
      ))}
    </div>
  );
}

/* ── Timeline Row ─────────────────────────────────────────── */
function TimelineRow({ layer, frameW, rowH, nameColW, totalFrames, clips, currentFrame, selectedClipId, onFrameClick, onClipSelect, onClipAdd, onClipUpdate, onClipDelete, onLayerClick, onLayerEdit, onLayerDelete }) {
  const [hov, setHov] = useState(false);
  const [dragging, setDragging] = useState(null); // { clipId, mode:'move'|'resize', startX, origStart, origDuration }
  const trackRef = useRef();

  const isBase  = layer.type === 'base';
  const isEmpty = layer.isEmpty;

  // Mouse move / up during drag
  useEffect(() => {
    if (!dragging) return;
    function onMove(e) {
      const dx = e.clientX - dragging.startX;
      const df = Math.round(dx / frameW);
      if (dragging.mode === 'move') {
        const newStart = clamp(dragging.origStart + df, 1, totalFrames);
        onClipUpdate(dragging.clipId, { start: newStart });
      } else {
        const newDur = clamp(dragging.origDuration + df, 1, totalFrames - dragging.origStart + 1);
        onClipUpdate(dragging.clipId, { duration: newDur });
      }
    }
    function onUp() { setDragging(null); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, frameW, totalFrames, onClipUpdate]);

  function handleTrackDblClick(e) {
    if (isBase || isEmpty) return;
    const rect = trackRef.current.getBoundingClientRect();
    const f = clamp(Math.floor((e.clientX - rect.left) / frameW) + 1, 1, totalFrames);
    onClipAdd(f);
  }

  function handleTrackClick(e) {
    const rect = trackRef.current.getBoundingClientRect();
    const f = clamp(Math.floor((e.clientX - rect.left) / frameW) + 1, 1, totalFrames);
    onFrameClick(f);
  }

  return (
    <div style={{ display:'flex', height:`${rowH}px`, borderBottom:'1px solid #0f172a', flexShrink:0 }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>

      {/* Layer name */}
      <div style={{ width:`${nameColW}px`, flexShrink:0, borderRight:'1px solid #1e293b', display:'flex', alignItems:'center', overflow:'hidden',
        background: hov ? '#1a2535' : '#0f172a', cursor: isEmpty ? 'pointer' : 'default' }}
        onClick={onLayerClick}>
        <div style={{ width:'4px', alignSelf:'stretch', flexShrink:0, background:`${layer.color}66` }}/>
        <div style={{ flex:1, paddingInline:'10px', display:'flex', alignItems:'center', gap:'7px', overflow:'hidden' }}>
          <span style={{ fontSize:'13px', flexShrink:0 }}>{isBase ? '🎞️' : layer.type==='character' ? '👤' : '🌄'}</span>
          <span style={{ fontSize:'12px', fontWeight:500, color: isEmpty ? `${layer.color}55` : '#94a3b8', fontStyle: isEmpty?'italic':'normal',
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {layer.label}
          </span>
        </div>
        {hov && !isBase && !isEmpty && (
          <div style={{ display:'flex', gap:'2px', paddingRight:'6px', flexShrink:0 }}>
            <button onClick={e=>{e.stopPropagation();onLayerEdit();}}
              style={{ background:'rgba(56,189,248,0.15)', border:'none', color:'#38bdf8', fontSize:'10px', fontWeight:700, padding:'2px 6px', borderRadius:'3px', cursor:'pointer' }}>
              Edit
            </button>
            <button onClick={e=>{e.stopPropagation();onLayerDelete();}}
              style={{ background:'rgba(239,68,68,0.15)', border:'none', color:'#ef4444', fontSize:'10px', fontWeight:700, padding:'2px 5px', borderRadius:'3px', cursor:'pointer' }}>
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Frame track */}
      <div ref={trackRef} style={{ flex:1, overflowX:'auto', position:'relative', cursor:'crosshair' }}
        onClick={handleTrackClick}
        onDoubleClick={handleTrackDblClick}>

        {/* Empty cells background */}
        <div style={{ display:'flex', height:'100%', position:'absolute', top:0, left:0 }}>
          {Array.from({ length: totalFrames }, (_, i) => (
            <div key={i} style={{
              width:`${frameW}px`, height:'100%', flexShrink:0,
              borderRight:'1px solid #1a2535',
              background: i+1 === currentFrame ? 'rgba(56,189,248,0.07)' : 'transparent',
            }}/>
          ))}
        </div>

        {/* Playhead line */}
        <div style={{
          position:'absolute', top:0, bottom:0, zIndex:10, pointerEvents:'none',
          left:`${(currentFrame-1)*frameW + frameW/2}px`,
          width:'2px', background:'#38bdf8', opacity:0.8,
        }}/>

        {/* Clips */}
        {isBase
          ? <BaseTrack totalFrames={totalFrames} frameW={frameW} rowH={rowH} color={layer.color}/>
          : clips.map(clip => (
              <Clip
                key={clip.id}
                clip={clip}
                frameW={frameW}
                rowH={rowH}
                color={layer.color}
                isSelected={clip.id === selectedClipId}
                onClick={e => { e.stopPropagation(); onClipSelect(clip.id); }}
                onMoveStart={(e, clipId) => { e.stopPropagation(); setDragging({ clipId, mode:'move', startX:e.clientX, origStart:clip.start, origDuration:clip.duration }); }}
                onResizeStart={(e, clipId) => { e.stopPropagation(); setDragging({ clipId, mode:'resize', startX:e.clientX, origStart:clip.start, origDuration:clip.duration }); }}
                onDelete={() => onClipDelete(clip.id)}
              />
            ))
        }
      </div>
    </div>
  );
}

/* ── BASE track (always filled) ──────────────────────────── */
function BaseTrack({ totalFrames, frameW, rowH, color }) {
  return (
    <div style={{
      position:'absolute', top:'4px', bottom:'4px', left:`${frameW * 0}px`,
      width:`${totalFrames * frameW}px`,
      background:`${color}20`, border:`1px solid ${color}40`,
      borderRadius:'4px', display:'flex', alignItems:'center',
      paddingLeft:'8px', pointerEvents:'none',
    }}>
      <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
        {Array.from({ length: totalFrames }, (_, i) => (
          <div key={i} style={{ width:'6px', height:'6px', borderRadius:'50%', background:color, opacity:.35, flexShrink:0 }}/>
        ))}
      </div>
    </div>
  );
}

/* ── Clip block ──────────────────────────────────────────── */
function Clip({ clip, frameW, rowH, color, isSelected, onClick, onMoveStart, onResizeStart, onDelete }) {
  const [hov, setHov] = useState(false);
  const left    = (clip.start - 1) * frameW;
  const width   = clip.duration * frameW - 2;

  return (
    <div
      style={{
        position:'absolute', top:'3px', bottom:'3px',
        left:`${left}px`, width:`${width}px`,
        background: isSelected ? `${color}50` : `${color}30`,
        border:`2px solid ${isSelected ? color : `${color}70`}`,
        borderRadius:'4px', cursor:'grab', zIndex:5,
        display:'flex', alignItems:'center', overflow:'hidden',
        transition:'background .1s',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      onMouseDown={e => onMoveStart(e, clip.id)}
    >
      {/* Clip image preview or dots */}
      {clip.imageUrl
        ? <img src={clip.imageUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:.85 }}/>
        : <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'3px', paddingInline:'4px' }}>
            {Array.from({ length: Math.min(clip.duration, 8) }, (_, i) => (
              <div key={i} style={{ width:'5px', height:'5px', borderRadius:'50%', background:color, opacity:.6, flexShrink:0 }}/>
            ))}
          </div>
      }

      {/* Duration label */}
      {width > 40 && (
        <span style={{ position:'absolute', left:'5px', top:'2px', fontSize:'9px', fontFamily:'monospace', color:color, fontWeight:700, opacity:.8, pointerEvents:'none' }}>
          {clip.duration}f
        </span>
      )}

      {/* Delete button on hover */}
      {hov && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ position:'absolute', top:'-1px', right:'14px', background:'#ef4444', border:'none', color:'#fff', fontSize:'9px', fontWeight:700, padding:'0px 4px', borderRadius:'2px', cursor:'pointer', zIndex:10, lineHeight:'14px' }}>
          ✕
        </button>
      )}

      {/* Resize handle */}
      <div
        style={{ position:'absolute', right:0, top:0, bottom:0, width:'8px', cursor:'ew-resize', background:`${color}40`, display:'flex', alignItems:'center', justifyContent:'center' }}
        onMouseDown={e => { e.stopPropagation(); onResizeStart(e, clip.id); }}
      >
        <div style={{ width:'2px', height:'12px', background:color, borderRadius:'1px', opacity:.8 }}/>
      </div>
    </div>
  );
}
