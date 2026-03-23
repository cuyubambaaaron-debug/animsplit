import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, slotsApi } from '../api';
import SlotModal from '../components/SlotModal';

const MAX_SLOTS    = 5;
const FRAME_W      = 32;   // px per frame cell
const ROW_H        = 34;   // px per row
const NAME_COL     = 180;  // px for name column
const TOTAL_FRAMES = 60;

function uid() { return Math.random().toString(36).slice(2); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default function Project() {
  const { id } = useParams();
  const [project, setProject]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState('');
  const [currentFrame, setCurrentFrame] = useState(1);
  const [selectedClip, setSelectedClip] = useState(null); // {layerId,clipId}
  const [clips, setClips]             = useState({});
  const [canvasDragOver, setCanvasDragOver] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      const { data } = await projectsApi.get(id);
      setProject(data); setNameInput(data.name);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function saveName() {
    if (!nameInput.trim() || nameInput === project?.name) { setEditingName(false); return; }
    await projectsApi.update(id, nameInput.trim());
    setProject(p => ({ ...p, name: nameInput.trim() }));
    setEditingName(false);
  }

  async function handleSave(formData) {
    const { type, slotNumber } = modal;
    if (type === 'character') await slotsApi.updateCharacter(id, slotNumber, formData);
    else await slotsApi.updateBackground(id, slotNumber, formData);
    await load(); setModal(null);
  }

  async function handleDelete(type, num) {
    if (!confirm('Remove layer?')) return;
    if (type === 'character') await slotsApi.deleteCharacter(id, num);
    else await slotsApi.deleteBackground(id, num);
    await load();
  }

  function getSlot(type, n) {
    return (type === 'character' ? project?.characters : project?.backgrounds)
      ?.find(s => s.slot_number === n) || null;
  }
  function usedSlots(type) {
    return ((type === 'character' ? project?.characters : project?.backgrounds) || []).length;
  }
  function nextFree(type) {
    const used = (type === 'character' ? project?.characters : project?.backgrounds) || [];
    for (let i = 1; i <= MAX_SLOTS; i++) if (!used.find(s => s.slot_number === i)) return i;
    return null;
  }

  function addClip(layerId, atFrame) {
    setClips(prev => {
      const existing = prev[layerId] || [];
      if (existing.some(c => atFrame >= c.start && atFrame < c.start + c.duration)) return prev;
      return { ...prev, [layerId]: [...existing, { id: uid(), start: atFrame, duration: 4, imageUrl: null }] };
    });
  }
  function updateClip(layerId, clipId, patch) {
    setClips(prev => ({ ...prev, [layerId]: (prev[layerId]||[]).map(c => c.id===clipId ? {...c,...patch} : c) }));
  }
  function deleteClip(layerId, clipId) {
    setClips(prev => ({ ...prev, [layerId]: (prev[layerId]||[]).filter(c => c.id!==clipId) }));
    if (selectedClip?.layerId===layerId && selectedClip?.clipId===clipId) setSelectedClip(null);
  }

  // Drop image onto canvas → assign to selected clip
  function handleCanvasDrop(e) {
    e.preventDefault(); setCanvasDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/') || !selectedClip) return;
    const url = URL.createObjectURL(file);
    updateClip(selectedClip.layerId, selectedClip.clipId, { imageUrl: url });
  }

  function getCurrentClipImage() {
    if (!selectedClip) return null;
    const c = (clips[selectedClip.layerId]||[]).find(c => c.id===selectedClip.clipId);
    return c?.imageUrl || null;
  }

  if (loading) return (
    <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f1f5f9',fontFamily:'Inter,sans-serif',color:'#94a3b8'}}>Loading…</div>
  );

  const charSlots = Array.from({length:MAX_SLOTS},(_,i)=>i+1).filter(n=>getSlot('character',n));
  const bgSlots   = Array.from({length:MAX_SLOTS},(_,i)=>i+1).filter(n=>getSlot('background',n));

  const layers = [
    { id:'base', type:'base', label:'BASE', color:'#818cf8' },
    ...(charSlots.length>0
      ? charSlots.map(n=>({ id:`char-${n}`, type:'character', num:n, label:getSlot('character',n)?.name||`Character ${n}`, color:'#38bdf8', slot:getSlot('character',n) }))
      : [{ id:'char-ph', type:'character', isEmpty:true, label:'+ Add Character', color:'#38bdf8' }]
    ),
    ...(bgSlots.length>0
      ? bgSlots.map(n=>({ id:`bg-${n}`, type:'background', num:n, label:getSlot('background',n)?.name||`Background ${n}`, color:'#34d399', slot:getSlot('background',n) }))
      : [{ id:'bg-ph', type:'background', isEmpty:true, label:'+ Add Background', color:'#34d399' }]
    ),
  ];

  const canvasImage = getCurrentClipImage();
  const selLayer = selectedClip ? layers.find(l=>l.id===selectedClip.layerId) : null;

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',fontFamily:'Inter,system-ui,sans-serif',overflow:'hidden',background:'#0f172a'}}>

      {/* ── TOP BAR ── */}
      <div style={{height:'44px',background:'#0f172a',borderBottom:'1px solid #1e293b',display:'flex',alignItems:'center',paddingInline:'14px',gap:'10px',flexShrink:0}}>
        <Link to="/" style={{textDecoration:'none',display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{fontSize:'17px'}}>🎬</span>
          <span style={{fontWeight:800,fontSize:'13px',color:'#f8fafc'}}>
            Macrometro <span style={{color:'#38bdf8'}}>Animation</span>
          </span>
        </Link>
        <span style={{width:'1px',height:'16px',background:'#1e293b'}}/>
        {editingName
          ? <input autoFocus value={nameInput} onChange={e=>setNameInput(e.target.value)}
              onBlur={saveName} onKeyDown={e=>e.key==='Enter'&&saveName()}
              style={{background:'transparent',border:'none',borderBottom:'1px solid #38bdf8',outline:'none',color:'#f8fafc',fontWeight:600,fontSize:'13px',width:'160px'}}/>
          : <button onClick={()=>setEditingName(true)}
              style={{background:'none',border:'none',color:'#cbd5e1',fontWeight:600,fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',gap:'5px',padding:0}}>
              {project.name} <span style={{color:'#334155',fontSize:'10px'}}>✏</span>
            </button>
        }
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'12px'}}>
          <span style={{color:'#475569',fontSize:'11px',fontFamily:'monospace'}}>
            Frame <span style={{color:'#38bdf8',fontWeight:700}}>{String(currentFrame).padStart(3,'0')}</span>
          </span>
          {selLayer && !selLayer.isEmpty && (
            <span style={{color:'#64748b',fontSize:'11px'}}>
              Layer: <span style={{color:selLayer.color,fontWeight:600}}>{selLayer.label}</span>
            </span>
          )}
          <Link to={`/project/${id}/upload`}
            style={{background:'#38bdf8',color:'#0f172a',fontWeight:700,fontSize:'12px',padding:'6px 14px',borderRadius:'6px',textDecoration:'none',boxShadow:'0 0 14px rgba(56,189,248,0.35)'}}>
            ▶ Upload & Process
          </Link>
        </div>
      </div>

      {/* ── CANVAS ── */}
      <div
        style={{flex:1,background:'#1e293b',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',minHeight:0,position:'relative',
          outline: canvasDragOver ? '3px dashed #38bdf8' : 'none',
          outlineOffset:'-8px',
        }}
        onDragOver={e=>{e.preventDefault();setCanvasDragOver(true);}}
        onDragLeave={()=>setCanvasDragOver(false)}
        onDrop={handleCanvasDrop}
      >
        {/* 16:9 white canvas */}
        <div style={{
          background:'#ffffff',
          boxShadow:'0 4px 40px rgba(0,0,0,0.5)',
          aspectRatio:'16/9',
          maxHeight:'calc(100% - 24px)',
          maxWidth:'calc(100% - 24px)',
          width:'min(100% - 24px, calc((100vh - 44px - 210px) * 16/9))',
          display:'flex',alignItems:'center',justifyContent:'center',
          position:'relative',overflow:'hidden',
        }}>
          {/* Subtle grid on empty canvas */}
          {!canvasImage && (
            <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(#f8fafc 1px,transparent 1px),linear-gradient(90deg,#f8fafc 1px,transparent 1px)',backgroundSize:'60px 60px',backgroundPosition:'center center'}}/>
          )}

          {canvasImage
            ? <img src={canvasImage} alt="frame" style={{width:'100%',height:'100%',objectFit:'contain'}}/>
            : <div style={{textAlign:'center',position:'relative',zIndex:1,padding:'20px'}}>
                {canvasDragOver
                  ? <p style={{color:'#38bdf8',fontWeight:700,fontSize:'15px'}}>Drop image here</p>
                  : <>
                      <p style={{color:'#cbd5e1',fontSize:'11px',fontFamily:'monospace',marginBottom:'6px',letterSpacing:'0.1em'}}>1920 × 1080</p>
                      <p style={{color:'#94a3b8',fontSize:'13px',fontWeight:600,marginBottom:'4px'}}>
                        {selLayer && !selLayer.isEmpty ? selLayer.label : project.name}
                      </p>
                      <p style={{color:'#cbd5e1',fontSize:'11px'}}>
                        {selLayer && !selLayer.isEmpty
                          ? 'Select a clip in the timeline · Double-click a cell to create one'
                          : 'Add layers in the timeline below'}
                      </p>
                      {selectedClip && <p style={{color:'#38bdf8',fontSize:'11px',marginTop:'8px'}}>← Drop an image here to assign it to the selected clip</p>}
                    </>
                }
              </div>
          }

          <div style={{position:'absolute',bottom:'6px',right:'8px',background:'rgba(0,0,0,0.06)',borderRadius:'3px',padding:'2px 6px',fontSize:'9px',color:'#94a3b8',fontFamily:'monospace'}}>
            {String(currentFrame).padStart(4,'0')}
          </div>
        </div>

        {/* Drop hint */}
        {selectedClip && !canvasDragOver && !canvasImage && (
          <div style={{position:'absolute',bottom:'12px',left:'50%',transform:'translateX(-50%)',background:'rgba(56,189,248,0.12)',border:'1px solid rgba(56,189,248,0.25)',borderRadius:'6px',padding:'5px 14px',fontSize:'11px',color:'#38bdf8',whiteSpace:'nowrap'}}>
            Drop an image onto the canvas to assign it to this clip
          </div>
        )}
      </div>

      {/* ── TIMELINE ── */}
      <div style={{background:'#0a0f1a',borderTop:'2px solid #020617',flexShrink:0}}>
        {/* Header row */}
        <div style={{height:'26px',background:'#060d1a',display:'flex',borderBottom:'1px solid #1e293b'}}>
          <div style={{width:`${NAME_COL}px`,flexShrink:0,borderRight:'1px solid #1e293b',display:'flex',alignItems:'center',justifyContent:'space-between',paddingInline:'10px'}}>
            <span style={{color:'#334155',fontSize:'10px',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}>Layers</span>
            <div style={{display:'flex',gap:'4px'}}>
              {usedSlots('character') < MAX_SLOTS &&
                <button onClick={()=>{const n=nextFree('character');if(n)setModal({type:'character',slotNumber:n,slot:null});}}
                  style={{background:'rgba(56,189,248,0.12)',border:'1px solid rgba(56,189,248,0.25)',color:'#38bdf8',fontSize:'9px',fontWeight:700,padding:'1px 6px',borderRadius:'3px',cursor:'pointer'}}>
                  👤+
                </button>
              }
              {usedSlots('background') < MAX_SLOTS &&
                <button onClick={()=>{const n=nextFree('background');if(n)setModal({type:'background',slotNumber:n,slot:null});}}
                  style={{background:'rgba(52,211,153,0.12)',border:'1px solid rgba(52,211,153,0.25)',color:'#34d399',fontSize:'9px',fontWeight:700,padding:'1px 6px',borderRadius:'3px',cursor:'pointer'}}>
                  🌄+
                </button>
              }
            </div>
          </div>
          {/* Ruler */}
          <div style={{flex:1,overflowX:'hidden',display:'flex',alignItems:'flex-end',paddingBottom:'3px'}}>
            {Array.from({length:TOTAL_FRAMES},(_,i)=>(
              <div key={i} onClick={()=>setCurrentFrame(i+1)}
                style={{width:`${FRAME_W}px`,flexShrink:0,textAlign:'center',cursor:'pointer',
                  fontSize:'9px',fontFamily:'monospace',
                  color: i+1===currentFrame ? '#38bdf8' : i%5===0 ? '#475569' : 'transparent',
                  fontWeight: i+1===currentFrame ? 700 : 400,
                  borderLeft: i%5===0 ? '1px solid #1e293b' : 'none',
                }}>
                {i%5===0 ? String(i+1).padStart(2,'0') : '·'}
              </div>
            ))}
          </div>
        </div>

        {/* Layer rows */}
        <div style={{overflowY:'auto',maxHeight:'170px'}}>
          {layers.map(layer => (
            <TimelineRow
              key={layer.id}
              layer={layer}
              frameW={FRAME_W} rowH={ROW_H} nameColW={NAME_COL} totalFrames={TOTAL_FRAMES}
              clips={clips[layer.id]||[]}
              currentFrame={currentFrame}
              selectedClipId={selectedClip?.layerId===layer.id ? selectedClip.clipId : null}
              onFrameClick={setCurrentFrame}
              onClipSelect={clipId=>setSelectedClip({layerId:layer.id,clipId})}
              onClipAdd={f=>addClip(layer.id,f)}
              onClipUpdate={(cid,p)=>updateClip(layer.id,cid,p)}
              onClipDelete={cid=>deleteClip(layer.id,cid)}
              onLayerClick={()=>{ if(layer.isEmpty){const n=nextFree(layer.type);if(n)setModal({type:layer.type,slotNumber:n,slot:null});} }}
              onLayerEdit={()=>layer.slot&&setModal({type:layer.type,slotNumber:layer.num,slot:layer.slot})}
              onLayerDelete={()=>layer.slot&&handleDelete(layer.type,layer.num)}
            />
          ))}
        </div>
      </div>

      {modal && <SlotModal slot={modal.slot} slotType={modal.type} onSave={handleSave} onClose={()=>setModal(null)}/>}
    </div>
  );
}

/* ── Timeline Row ─────────────────────────────────────── */
function TimelineRow({ layer, frameW, rowH, nameColW, totalFrames, clips, currentFrame, selectedClipId, onFrameClick, onClipSelect, onClipAdd, onClipUpdate, onClipDelete, onLayerClick, onLayerEdit, onLayerDelete }) {
  const [hov, setHov]       = useState(false);
  const [dragging, setDragging] = useState(null);
  const trackRef = useRef();

  const isBase  = layer.type === 'base';
  const isEmpty = layer.isEmpty;

  useEffect(() => {
    if (!dragging) return;
    function onMove(e) {
      const df = Math.round((e.clientX - dragging.startX) / frameW);
      if (dragging.mode==='move') {
        onClipUpdate(dragging.clipId, { start: clamp(dragging.origStart+df, 1, totalFrames) });
      } else {
        onClipUpdate(dragging.clipId, { duration: clamp(dragging.origDur+df, 1, totalFrames-dragging.origStart+1) });
      }
    }
    function onUp() { setDragging(null); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return ()=>{ window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
  }, [dragging, frameW, totalFrames, onClipUpdate]);

  function handleDblClick(e) {
    if (isBase||isEmpty) return;
    const rect = trackRef.current.getBoundingClientRect();
    const f = clamp(Math.floor((e.clientX-rect.left)/frameW)+1,1,totalFrames);
    onClipAdd(f);
  }

  function handleTrackClick(e) {
    if (e.target !== trackRef.current && !e.target.classList?.contains('cell')) return;
    const rect = trackRef.current.getBoundingClientRect();
    const f = clamp(Math.floor((e.clientX-rect.left)/frameW)+1,1,totalFrames);
    onFrameClick(f);
  }

  const rowBg = hov ? '#0d1525' : '#0a0f1a';

  return (
    <div style={{display:'flex',height:`${rowH}px`,borderBottom:'1px solid #0d1525',flexShrink:0}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>

      {/* Layer name col */}
      <div style={{width:`${nameColW}px`,flexShrink:0,borderRight:'1px solid #1e293b',
        background:rowBg,display:'flex',alignItems:'center',overflow:'hidden',cursor:isEmpty?'pointer':'default'}}
        onClick={onLayerClick}>
        <div style={{width:'3px',alignSelf:'stretch',flexShrink:0,background:`${layer.color}55`}}/>
        <div style={{flex:1,paddingInline:'10px',display:'flex',alignItems:'center',gap:'7px',overflow:'hidden'}}>
          <span style={{fontSize:'12px',flexShrink:0}}>{isBase?'🎞️':layer.type==='character'?'👤':'🌄'}</span>
          <span style={{fontSize:'11px',fontWeight:600,
            color: isEmpty ? `${layer.color}44` : '#94a3b8',
            fontStyle:isEmpty?'italic':'normal',
            whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            {layer.label}
          </span>
        </div>
        {hov && !isBase && !isEmpty && (
          <div style={{display:'flex',gap:'2px',paddingRight:'6px',flexShrink:0}}>
            <button onClick={e=>{e.stopPropagation();onLayerEdit();}}
              style={{background:'rgba(56,189,248,0.1)',border:'none',color:'#38bdf8',fontSize:'9px',padding:'2px 5px',borderRadius:'3px',cursor:'pointer',fontWeight:700}}>
              Edit
            </button>
            <button onClick={e=>{e.stopPropagation();onLayerDelete();}}
              style={{background:'rgba(239,68,68,0.1)',border:'none',color:'#ef4444',fontSize:'9px',padding:'2px 5px',borderRadius:'3px',cursor:'pointer',fontWeight:700}}>
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Frame track */}
      <div ref={trackRef} style={{flex:1,overflowX:'hidden',position:'relative',cursor:'default'}}
        onClick={handleTrackClick}
        onDoubleClick={handleDblClick}>

        {/* Frame cells grid */}
        <div style={{display:'flex',height:'100%',position:'absolute',inset:0}}>
          {Array.from({length:totalFrames},(_,i)=>(
            <div key={i} className="cell" style={{
              width:`${frameW}px`, height:'100%', flexShrink:0,
              borderRight: i%5===4 ? '1px solid #1e293b' : '1px solid #111827',
              background: i+1===currentFrame
                ? 'rgba(56,189,248,0.1)'
                : i%2===0 ? '#0a0f1a' : '#090e18',
              cursor:'default',
            }}/>
          ))}
        </div>

        {/* Playhead */}
        <div style={{position:'absolute',top:0,bottom:0,left:`${(currentFrame-1)*frameW + frameW/2 - 1}px`,width:'2px',background:'#38bdf8',opacity:0.9,zIndex:20,pointerEvents:'none'}}/>

        {/* BASE: filled bar */}
        {isBase && (
          <div style={{position:'absolute',top:'6px',bottom:'6px',left:0,right:0,background:`${layer.color}18`,border:`1px solid ${layer.color}30`,borderRadius:'3px',display:'flex',alignItems:'center',paddingLeft:'8px',pointerEvents:'none',overflow:'hidden'}}>
            {Array.from({length:totalFrames},(_,i)=>(
              <div key={i} style={{width:`${frameW}px`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{width:'6px',height:'6px',borderRadius:'50%',background:layer.color,opacity:0.4}}/>
              </div>
            ))}
          </div>
        )}

        {/* Clips */}
        {!isBase && clips.map(clip=>(
          <ClipBlock
            key={clip.id}
            clip={clip}
            frameW={frameW}
            rowH={rowH}
            color={layer.color}
            isSelected={clip.id===selectedClipId}
            onClick={e=>{e.stopPropagation();onClipSelect(clip.id);onFrameClick(clip.start);}}
            onMoveStart={(e)=>{e.stopPropagation();setDragging({clipId:clip.id,mode:'move',startX:e.clientX,origStart:clip.start,origDur:clip.duration});}}
            onResizeStart={(e)=>{e.stopPropagation();setDragging({clipId:clip.id,mode:'resize',startX:e.clientX,origStart:clip.start,origDur:clip.duration});}}
            onDelete={()=>onClipDelete(clip.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Clip Block ───────────────────────────────────────── */
function ClipBlock({ clip, frameW, rowH, color, isSelected, onClick, onMoveStart, onResizeStart, onDelete }) {
  const [hov, setHov] = useState(false);
  const left  = (clip.start-1)*frameW;
  const width = clip.duration*frameW - 2;

  return (
    <div
      style={{
        position:'absolute', top:'4px', bottom:'4px',
        left:`${left}px`, width:`${width}px`,
        background: isSelected ? `${color}45` : `${color}25`,
        border:`2px solid ${isSelected ? color : `${color}60`}`,
        borderRadius:'4px', zIndex:10, overflow:'hidden',
        boxShadow: isSelected ? `0 0 8px ${color}40` : 'none',
        cursor:'grab',
      }}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      onClick={onClick}
      onMouseDown={onMoveStart}
    >
      {/* Thumbnail or dot pattern */}
      {clip.imageUrl
        ? <img src={clip.imageUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover',opacity:.9}}/>
        : <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:'3px',paddingInline:'5px'}}>
            {Array.from({length:Math.min(clip.duration,10)},(_,i)=>(
              <div key={i} style={{width:'4px',height:'4px',borderRadius:'50%',background:color,opacity:0.7,flexShrink:0}}/>
            ))}
          </div>
      }

      {/* Duration label */}
      {width>36 && (
        <span style={{position:'absolute',top:'2px',left:'4px',fontSize:'8px',fontFamily:'monospace',color:color,fontWeight:700,opacity:.9,pointerEvents:'none'}}>
          {clip.duration}f
        </span>
      )}

      {/* Delete on hover */}
      {hov && (
        <button onClick={e=>{e.stopPropagation();onDelete();}}
          style={{position:'absolute',top:'1px',right:'10px',background:'#ef4444',border:'none',color:'#fff',fontSize:'8px',fontWeight:700,padding:'0 3px',borderRadius:'2px',cursor:'pointer',zIndex:20,lineHeight:'13px'}}>
          ✕
        </button>
      )}

      {/* Resize handle */}
      <div
        style={{position:'absolute',right:0,top:0,bottom:0,width:'7px',cursor:'ew-resize',
          background:`${color}30`,display:'flex',alignItems:'center',justifyContent:'center'}}
        onMouseDown={e=>{e.stopPropagation();onResizeStart(e);}}
      >
        <div style={{width:'2px',height:'10px',background:color,borderRadius:'1px',opacity:.9}}/>
      </div>
    </div>
  );
}
