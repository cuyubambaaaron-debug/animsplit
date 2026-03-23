import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, slotsApi } from '../api';
import SlotModal from '../components/SlotModal';

const MAX_SLOTS  = 5;
const FRAME_W    = 36;   // px per frame
const ROW_H      = 38;
const NAME_COL   = 185;

function uid() { return Math.random().toString(36).slice(2); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default function Project() {
  const { id } = useParams();
  const [project,      setProject]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(null);
  const [editingName,  setEditingName]  = useState(false);
  const [nameInput,    setNameInput]    = useState('');
  const [currentFrame, setCurrentFrame] = useState(0); // index into baseFrames or -1
  const [selectedBase, setSelectedBase] = useState(null); // frameId in BASE
  const [clips,        setClips]        = useState({});   // for char/bg layers
  const [canvasOver,   setCanvasOver]   = useState(false);

  // BASE frames — each frame is { id, imageUrl }
  const [baseFrames, setBaseFrames] = useState([]);

  const canvasRef  = useRef();
  const fileRef    = useRef();

  // ── Asignar imagen al frame BASE seleccionado ────────────────
  function assignImageToFrame(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (!selectedBase) return;
    const url = URL.createObjectURL(file);
    setBaseFrames(prev => prev.map(f => f.id === selectedBase ? { ...f, imageUrl: url } : f));
  }

  function handleCanvasClick() {
    if (!selectedBase) return;
    fileRef.current?.click();
  }

  function handleFileChange(e) {
    assignImageToFrame(e.target.files?.[0]);
    e.target.value = '';
  }

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

  async function handleSave(fd) {
    const { type, slotNumber } = modal;
    if (type === 'character') await slotsApi.updateCharacter(id, slotNumber, fd);
    else await slotsApi.updateBackground(id, slotNumber, fd);
    await load(); setModal(null);
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
  function usedSlots(type) {
    return ((type === 'character' ? project?.characters : project?.backgrounds) || []).length;
  }
  function nextFree(type) {
    const used = (type === 'character' ? project?.characters : project?.backgrounds) || [];
    for (let i = 1; i <= MAX_SLOTS; i++) if (!used.find(s => s.slot_number === i)) return i;
    return null;
  }

  // BASE helpers
  function addBaseFrame() {
    const newFrame = { id: uid(), imageUrl: null };
    setBaseFrames(prev => [...prev, newFrame]);
    setSelectedBase(newFrame.id);
  }
  function deleteBaseFrame(fid) {
    setBaseFrames(prev => prev.filter(f => f.id !== fid));
    if (selectedBase === fid) setSelectedBase(null);
  }

  // Char/bg clip helpers
  function addClip(layerId, atFrame) {
    setClips(prev => {
      const ex = prev[layerId] || [];
      if (ex.some(c => atFrame >= c.start && atFrame < c.start + c.duration)) return prev;
      return { ...prev, [layerId]: [...ex, { id: uid(), start: atFrame, duration: 4, imageUrl: null }] };
    });
  }
  function updateClip(layerId, clipId, patch) {
    setClips(prev => ({ ...prev, [layerId]: (prev[layerId]||[]).map(c => c.id===clipId ? {...c,...patch} : c) }));
  }
  function deleteClip(layerId, clipId) {
    setClips(prev => ({ ...prev, [layerId]: (prev[layerId]||[]).filter(c => c.id!==clipId) }));
  }

  // Current canvas image
  const canvasImg = selectedBase
    ? baseFrames.find(f => f.id === selectedBase)?.imageUrl || null
    : null;

  if (loading) return (
    <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f172a',color:'#475569',fontFamily:'Inter,sans-serif'}}>Loading…</div>
  );

  const charSlots = Array.from({length:MAX_SLOTS},(_,i)=>i+1).filter(n=>getSlot('character',n));
  const bgSlots   = Array.from({length:MAX_SLOTS},(_,i)=>i+1).filter(n=>getSlot('background',n));

  const charLayers = charSlots.length > 0
    ? charSlots.map(n=>({ id:`char-${n}`, type:'character', num:n, label:getSlot('character',n)?.name||`Character ${n}`, color:'#38bdf8', slot:getSlot('character',n) }))
    : [{ id:'char-ph', type:'character', isEmpty:true, label:'+ Add Character', color:'#38bdf8' }];

  const bgLayers = bgSlots.length > 0
    ? bgSlots.map(n=>({ id:`bg-${n}`, type:'background', num:n, label:getSlot('background',n)?.name||`Background ${n}`, color:'#34d399', slot:getSlot('background',n) }))
    : [{ id:'bg-ph', type:'background', isEmpty:true, label:'+ Add Background', color:'#34d399' }];

  const totalVisible = Math.max(baseFrames.length + 4, 30);

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',fontFamily:'Inter,system-ui,sans-serif',overflow:'hidden',background:'#0f172a'}}>

      {/* ── TOP BAR ── */}
      <div style={{height:'44px',background:'#020617',borderBottom:'1px solid #1e293b',display:'flex',alignItems:'center',paddingInline:'14px',gap:'10px',flexShrink:0}}>
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
              style={{background:'none',border:'none',color:'#cbd5e1',fontWeight:600,fontSize:'13px',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:'5px'}}>
              {project.name} <span style={{color:'#334155',fontSize:'10px'}}>✏</span>
            </button>
        }
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'12px'}}>
          <span style={{color:'#334155',fontSize:'11px',fontFamily:'monospace'}}>
            BASE <span style={{color:'#818cf8',fontWeight:700}}>{baseFrames.length}</span> frames
          </span>
          <Link to={`/project/${id}/upload`}
            style={{background:'#38bdf8',color:'#0f172a',fontWeight:700,fontSize:'12px',padding:'6px 14px',borderRadius:'6px',textDecoration:'none',boxShadow:'0 0 12px rgba(56,189,248,0.3)'}}>
            ▶ Upload & Process
          </Link>
        </div>
      </div>

      {/* ── CANVAS ── */}
      <div style={{flex:1,background:'#1a2235',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',minHeight:0,position:'relative'}}>

        {/* hidden file input */}
        <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFileChange}/>

        {/* White 16:9 canvas */}
        <div
          ref={canvasRef}
          onClick={handleCanvasClick}
          onDragOver={e => { e.preventDefault(); setCanvasOver(true); }}
          onDragLeave={() => setCanvasOver(false)}
          onDrop={e => { e.preventDefault(); setCanvasOver(false); assignImageToFrame(e.dataTransfer.files?.[0]); }}
          style={{
            background: canvasOver ? '#f0f9ff' : '#ffffff',
            boxShadow: canvasOver
              ? '0 0 0 3px #38bdf8, 0 8px 40px rgba(0,0,0,0.4)'
              : '0 8px 40px rgba(0,0,0,0.4)',
            aspectRatio:'16/9',
            maxHeight:'calc(100% - 20px)',
            maxWidth:'calc(100% - 20px)',
            width:'min(100% - 20px, calc((100vh - 44px - 220px) * 16/9))',
            display:'flex',alignItems:'center',justifyContent:'center',
            position:'relative',overflow:'hidden',
            transition:'box-shadow .15s, background .15s',
            cursor: selectedBase ? 'pointer' : 'default',
          }}
        >
          {/* todos los hijos con pointer-events:none para no bloquear el drop */}
          {/* Grid lines on empty canvas */}
          {!canvasImg && (
            <div style={{position:'absolute',inset:0,pointerEvents:'none',
              backgroundImage:'linear-gradient(#f1f5f9 1px,transparent 1px),linear-gradient(90deg,#f1f5f9 1px,transparent 1px)',
              backgroundSize:'64px 64px'}}/>
          )}

          {canvasImg
            ? <img src={canvasImg} alt="frame" style={{width:'100%',height:'100%',objectFit:'contain',position:'relative',zIndex:1,pointerEvents:'none'}}/>
            : <div style={{position:'relative',zIndex:1,textAlign:'center',padding:'24px',pointerEvents:'none'}}>
                {canvasOver
                  ? <p style={{color:'#38bdf8',fontWeight:700,fontSize:'16px'}}>📥 Suelta la imagen aquí</p>
                  : <>
                      <p style={{color:'#94a3b8',fontSize:'12px',fontFamily:'monospace',marginBottom:'8px'}}>1920 × 1080</p>
                      <p style={{color:'#64748b',fontSize:'13px',fontWeight:600,marginBottom:'6px'}}>{project.name}</p>
                      {selectedBase
                        ? <p style={{color:'#38bdf8',fontSize:'13px',fontWeight:600}}>Click aquí para elegir imagen<br/><span style={{fontSize:'11px',fontWeight:400,color:'#64748b'}}>o arrastra un PNG/JPG</span></p>
                        : <p style={{color:'#94a3b8',fontSize:'12px'}}>Presiona <b>+</b> en BASE y selecciona un frame</p>
                      }
                    </>
                }
              </div>
          }

          {/* Frame label */}
          {selectedBase && (
            <div style={{position:'absolute',bottom:'6px',right:'8px',background:'rgba(0,0,0,0.12)',borderRadius:'3px',padding:'2px 7px',fontSize:'9px',color:'#94a3b8',fontFamily:'monospace',zIndex:2,pointerEvents:'none'}}>
              Frame {(baseFrames.findIndex(f=>f.id===selectedBase)+1).toString().padStart(4,'0')}
            </div>
          )}
        </div>

        {/* Hint bar */}
        {selectedBase && !canvasImg && (
          <div style={{position:'absolute',bottom:'10px',left:'50%',transform:'translateX(-50%)',
            background:'rgba(129,140,248,0.15)',border:'1px solid rgba(129,140,248,0.3)',
            borderRadius:'6px',padding:'5px 14px',fontSize:'11px',color:'#818cf8',whiteSpace:'nowrap',pointerEvents:'none'}}>
            Frame seleccionado — arrastra una imagen PNG/JPG al lienzo
          </div>
        )}
      </div>

      {/* ── TIMELINE ── */}
      <div style={{background:'#020617',borderTop:'2px solid #000',flexShrink:0}}>

        {/* Header / ruler */}
        <div style={{height:'24px',background:'#000',display:'flex',borderBottom:'1px solid #0f172a'}}>
          <div style={{width:`${NAME_COL}px`,flexShrink:0,borderRight:'1px solid #0f172a',display:'flex',alignItems:'center',justifyContent:'space-between',paddingInline:'8px'}}>
            <span style={{color:'#1e293b',fontSize:'9px',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}>Layers</span>
            <div style={{display:'flex',gap:'3px'}}>
              {usedSlots('character') < MAX_SLOTS &&
                <button onClick={()=>{const n=nextFree('character');if(n)setModal({type:'character',slotNumber:n,slot:null});}}
                  style={{background:'rgba(56,189,248,0.1)',border:'1px solid rgba(56,189,248,0.2)',color:'#38bdf8',fontSize:'9px',fontWeight:700,padding:'1px 5px',borderRadius:'3px',cursor:'pointer'}}>👤+</button>
              }
              {usedSlots('background') < MAX_SLOTS &&
                <button onClick={()=>{const n=nextFree('background');if(n)setModal({type:'background',slotNumber:n,slot:null});}}
                  style={{background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.2)',color:'#34d399',fontSize:'9px',fontWeight:700,padding:'1px 5px',borderRadius:'3px',cursor:'pointer'}}>🌄+</button>
              }
            </div>
          </div>
          {/* Frame numbers */}
          <div style={{flex:1,overflowX:'hidden',display:'flex',alignItems:'flex-end',paddingBottom:'2px'}}>
            {Array.from({length:totalVisible},(_,i)=>(
              <div key={i} style={{width:`${FRAME_W}px`,flexShrink:0,textAlign:'center',
                fontSize:'8px',fontFamily:'monospace',
                color: i < baseFrames.length ? '#334155' : '#1a2535',
                borderLeft: i%5===0 ? '1px solid #0f172a' : 'none',
              }}>
                {i%5===0 ? String(i+1).padStart(2,'0') : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div style={{overflowY:'auto',maxHeight:'168px'}}>

          {/* ── BASE ROW ── */}
          <BaseRow
            frames={baseFrames}
            selectedId={selectedBase}
            frameW={FRAME_W}
            rowH={ROW_H}
            nameColW={NAME_COL}
            totalVisible={totalVisible}
            onSelect={setSelectedBase}
            onAdd={addBaseFrame}
            onDelete={deleteBaseFrame}
          />

          {/* ── CHARACTER ROWS ── */}
          {charLayers.map(layer => (
            <ClipRow
              key={layer.id}
              layer={layer}
              frameW={FRAME_W} rowH={ROW_H} nameColW={NAME_COL} totalVisible={totalVisible}
              clips={clips[layer.id]||[]}
              onClipAdd={f=>addClip(layer.id,f)}
              onClipUpdate={(cid,p)=>updateClip(layer.id,cid,p)}
              onClipDelete={cid=>deleteClip(layer.id,cid)}
              onLayerClick={()=>{ if(layer.isEmpty){const n=nextFree('character');if(n)setModal({type:'character',slotNumber:n,slot:null}); }}}
              onLayerEdit={()=>layer.slot&&setModal({type:'character',slotNumber:layer.num,slot:layer.slot})}
              onLayerDelete={()=>handleDelete('character',layer.num)}
            />
          ))}

          {/* ── BACKGROUND ROWS ── */}
          {bgLayers.map(layer => (
            <ClipRow
              key={layer.id}
              layer={layer}
              frameW={FRAME_W} rowH={ROW_H} nameColW={NAME_COL} totalVisible={totalVisible}
              clips={clips[layer.id]||[]}
              onClipAdd={f=>addClip(layer.id,f)}
              onClipUpdate={(cid,p)=>updateClip(layer.id,cid,p)}
              onClipDelete={cid=>deleteClip(layer.id,cid)}
              onLayerClick={()=>{ if(layer.isEmpty){const n=nextFree('background');if(n)setModal({type:'background',slotNumber:n,slot:null}); }}}
              onLayerEdit={()=>layer.slot&&setModal({type:'background',slotNumber:layer.num,slot:layer.slot})}
              onLayerDelete={()=>handleDelete('background',layer.num)}
            />
          ))}
        </div>
      </div>

      {modal && <SlotModal slot={modal.slot} slotType={modal.type} onSave={handleSave} onClose={()=>setModal(null)}/>}
    </div>
  );
}

/* ── BASE ROW ──────────────────────────────────────────── */
function BaseRow({ frames, selectedId, frameW, rowH, nameColW, totalVisible, onSelect, onAdd, onDelete }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{display:'flex',height:`${rowH}px`,borderBottom:'1px solid #0a0f1a',flexShrink:0,background:hov?'#050a14':'#020617'}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>

      {/* Name col */}
      <div style={{width:`${nameColW}px`,flexShrink:0,borderRight:'1px solid #0f172a',display:'flex',alignItems:'center',overflow:'hidden'}}>
        <div style={{width:'3px',alignSelf:'stretch',flexShrink:0,background:'#818cf855'}}/>
        <div style={{flex:1,paddingInline:'8px',display:'flex',alignItems:'center',gap:'6px'}}>
          <span style={{fontSize:'12px'}}>🎞️</span>
          <span style={{fontSize:'11px',fontWeight:700,color:'#818cf8'}}>BASE</span>
          <span style={{fontSize:'10px',color:'#334155',fontFamily:'monospace'}}>{frames.length}f</span>
        </div>
        {/* + button — ONLY on BASE */}
        <button
          onClick={onAdd}
          title="Add frame"
          style={{marginRight:'8px',background:'#818cf8',border:'none',color:'#fff',fontWeight:900,fontSize:'14px',width:'20px',height:'20px',borderRadius:'4px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,lineHeight:1}}>
          +
        </button>
      </div>

      {/* Frame cells */}
      <div style={{flex:1,overflowX:'hidden',position:'relative',display:'flex',alignItems:'center'}}>
        {/* Grid */}
        {Array.from({length:totalVisible},(_,i)=>(
          <div key={i} style={{width:`${frameW}px`,height:'100%',flexShrink:0,
            borderRight: i%5===4 ? '1px solid #0f172a' : '1px solid #070d18',
            background:'transparent',flexShrink:0}}/>
        ))}

        {/* Frame thumbnails */}
        {frames.map((frame, idx) => {
          const isSel = frame.id === selectedId;
          return (
            <div
              key={frame.id}
              title={`Frame ${idx+1} — click to select, double-click to delete`}
              onClick={() => onSelect(frame.id)}
              onDoubleClick={() => onDelete(frame.id)}
              style={{
                position:'absolute',
                left:`${idx * frameW + 2}px`,
                top:'4px', bottom:'4px',
                width:`${frameW - 4}px`,
                background: isSel ? 'rgba(129,140,248,0.5)' : (frame.imageUrl ? 'transparent' : 'rgba(129,140,248,0.15)'),
                border:`2px solid ${isSel ? '#818cf8' : 'rgba(129,140,248,0.3)'}`,
                borderRadius:'3px',
                cursor:'pointer',
                overflow:'hidden',
                display:'flex',alignItems:'center',justifyContent:'center',
                zIndex:5,
                boxShadow: isSel ? '0 0 8px #818cf880' : 'none',
              }}
            >
              {frame.imageUrl
                ? <img src={frame.imageUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                : <span style={{fontSize:'8px',color:'#818cf8',opacity:.7,fontFamily:'monospace'}}>{String(idx+1).padStart(3,'0')}</span>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── CLIP ROW (character / background) ────────────────── */
function ClipRow({ layer, frameW, rowH, nameColW, totalVisible, clips, onClipAdd, onClipUpdate, onClipDelete, onLayerClick, onLayerEdit, onLayerDelete }) {
  const [hov, setHov]       = useState(false);
  const [dragging, setDragging] = useState(null);
  const trackRef = useRef();

  useEffect(() => {
    if (!dragging) return;
    function onMove(e) {
      const df = Math.round((e.clientX - dragging.startX) / frameW);
      if (dragging.mode === 'move')
        onClipUpdate(dragging.clipId, { start: clamp(dragging.origStart + df, 1, totalVisible) });
      else
        onClipUpdate(dragging.clipId, { duration: clamp(dragging.origDur + df, 1, totalVisible - dragging.origStart + 1) });
    }
    function onUp() { setDragging(null); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, frameW, totalVisible, onClipUpdate]);

  function handleDbl(e) {
    if (layer.isEmpty) return;
    const rect = trackRef.current.getBoundingClientRect();
    const f = clamp(Math.floor((e.clientX - rect.left) / frameW) + 1, 1, totalVisible);
    onClipAdd(f);
  }

  return (
    <div style={{display:'flex',height:`${rowH}px`,borderBottom:'1px solid #0a0f1a',flexShrink:0,background:hov?'#050a14':'#020617'}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>

      {/* Name */}
      <div style={{width:`${nameColW}px`,flexShrink:0,borderRight:'1px solid #0f172a',display:'flex',alignItems:'center',overflow:'hidden',cursor:layer.isEmpty?'pointer':'default'}}
        onClick={onLayerClick}>
        <div style={{width:'3px',alignSelf:'stretch',flexShrink:0,background:`${layer.color}55`}}/>
        <div style={{flex:1,paddingInline:'8px',display:'flex',alignItems:'center',gap:'6px',overflow:'hidden'}}>
          <span style={{fontSize:'12px',flexShrink:0}}>{layer.type==='character'?'👤':'🌄'}</span>
          <span style={{fontSize:'11px',fontWeight:500,
            color:layer.isEmpty?`${layer.color}40`:'#64748b',
            fontStyle:layer.isEmpty?'italic':'normal',
            whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            {layer.label}
          </span>
        </div>
        {hov && !layer.isEmpty && (
          <div style={{display:'flex',gap:'2px',paddingRight:'6px',flexShrink:0}}>
            <button onClick={e=>{e.stopPropagation();onLayerEdit();}}
              style={{background:'transparent',border:'none',color:`${layer.color}`,fontSize:'9px',cursor:'pointer',padding:'2px 5px',borderRadius:'3px',fontWeight:700}}>Edit</button>
            <button onClick={e=>{e.stopPropagation();onLayerDelete();}}
              style={{background:'transparent',border:'none',color:'#ef4444',fontSize:'9px',cursor:'pointer',padding:'2px 5px',borderRadius:'3px',fontWeight:700}}>✕</button>
          </div>
        )}
      </div>

      {/* Track */}
      <div ref={trackRef} style={{flex:1,overflowX:'hidden',position:'relative',cursor:'default'}}
        onDoubleClick={handleDbl}>

        {/* Grid cells */}
        {Array.from({length:totalVisible},(_,i)=>(
          <div key={i} style={{position:'absolute',left:`${i*frameW}px`,top:0,bottom:0,width:`${frameW}px`,
            borderRight: i%5===4 ? '1px solid #0f172a' : '1px solid #070d18',
            background: i%2===0?'#020617':'#030812',
          }}/>
        ))}

        {/* Clips */}
        {clips.map(clip => (
          <ClipBlock
            key={clip.id}
            clip={clip}
            frameW={frameW}
            color={layer.color}
            onMoveStart={e=>{e.stopPropagation();setDragging({clipId:clip.id,mode:'move',startX:e.clientX,origStart:clip.start,origDur:clip.duration});}}
            onResizeStart={e=>{e.stopPropagation();setDragging({clipId:clip.id,mode:'resize',startX:e.clientX,origStart:clip.start,origDur:clip.duration});}}
            onDelete={()=>onClipDelete(clip.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Clip Block ───────────────────────────────────────── */
function ClipBlock({ clip, frameW, color, onMoveStart, onResizeStart, onDelete }) {
  const [hov, setHov] = useState(false);
  const left  = (clip.start - 1) * frameW;
  const width = clip.duration * frameW - 2;
  return (
    <div
      style={{position:'absolute',top:'4px',bottom:'4px',left:`${left}px`,width:`${width}px`,
        background:`${color}25`,border:`2px solid ${color}55`,borderRadius:'3px',
        zIndex:10,overflow:'hidden',cursor:'grab'}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onMouseDown={onMoveStart}
    >
      <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:'3px',paddingInline:'4px'}}>
        {Array.from({length:Math.min(clip.duration,12)},(_,i)=>(
          <div key={i} style={{width:'4px',height:'4px',borderRadius:'50%',background:color,opacity:.6,flexShrink:0}}/>
        ))}
      </div>
      {width > 34 && <span style={{position:'absolute',top:'2px',left:'4px',fontSize:'8px',fontFamily:'monospace',color,fontWeight:700,opacity:.8}}>{clip.duration}f</span>}
      {hov && (
        <button onClick={e=>{e.stopPropagation();onDelete();}}
          style={{position:'absolute',top:'1px',right:'10px',background:'#ef4444',border:'none',color:'#fff',fontSize:'8px',fontWeight:700,padding:'0 3px',borderRadius:'2px',cursor:'pointer',zIndex:20,lineHeight:'13px'}}>✕</button>
      )}
      <div style={{position:'absolute',right:0,top:0,bottom:0,width:'7px',cursor:'ew-resize',background:`${color}20`,display:'flex',alignItems:'center',justifyContent:'center'}}
        onMouseDown={e=>{e.stopPropagation();onResizeStart(e);}}>
        <div style={{width:'2px',height:'10px',background:color,borderRadius:'1px',opacity:.8}}/>
      </div>
    </div>
  );
}
