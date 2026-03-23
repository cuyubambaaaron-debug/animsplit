import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, slotsApi } from '../api';
import SlotModal from '../components/SlotModal';

const MAX_SLOTS  = 5;
const FRAME_W    = 36;
const ROW_H      = 38;
const NAME_COL   = 185;
const DRAW_W     = 1920;
const DRAW_H     = 1080;

function uid() { return Math.random().toString(36).slice(2); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default function Project() {
  const { id } = useParams();
  const [project,      setProject]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(null);
  const [editingName,  setEditingName]  = useState(false);
  const [nameInput,    setNameInput]    = useState('');
  const [selectedBase, setSelectedBase] = useState(null);
  const [clips,        setClips]        = useState({});
  const [canvasOver,   setCanvasOver]   = useState(false);
  const [baseFrames,   setBaseFrames]   = useState([]);

  // Tools: 'move' | 'pencil' | 'eraser'
  const [tool,        setTool]        = useState('move');
  const [pencilColor, setPencilColor] = useState('#000000');
  const [pencilSize,  setPencilSize]  = useState(4);

  const fileRef      = useRef();
  const drawCanvasRef = useRef();   // HTML5 canvas for drawing
  const imgDragRef   = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef   = useRef(null);

  // ── Load project ─────────────────────────────────────────────
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
    return (type==='character' ? project?.characters : project?.backgrounds)?.find(s=>s.slot_number===n)||null;
  }
  function usedSlots(type) {
    return ((type==='character' ? project?.characters : project?.backgrounds)||[]).length;
  }
  function nextFree(type) {
    const used = (type==='character' ? project?.characters : project?.backgrounds)||[];
    for(let i=1;i<=MAX_SLOTS;i++) if(!used.find(s=>s.slot_number===i)) return i;
    return null;
  }

  // ── BASE frames ───────────────────────────────────────────────
  function addBaseFrame() {
    const f = { id:uid(), imageUrl:null, x:0, y:0, scale:1, drawing:null };
    setBaseFrames(prev => [...prev, f]);
    setSelectedBase(f.id);
  }
  function deleteBaseFrame(fid) {
    setBaseFrames(prev => prev.filter(f=>f.id!==fid));
    if (selectedBase===fid) setSelectedBase(null);
  }

  // ── Restore drawing layer when switching frames ───────────────
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, DRAW_W, DRAW_H);
    const frame = baseFrames.find(f=>f.id===selectedBase);
    if (frame?.drawing) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, DRAW_W, DRAW_H);
      img.src = frame.drawing;
    }
  }, [selectedBase]);

  // ── Save drawing layer to frame ───────────────────────────────
  function saveDrawing() {
    if (!selectedBase || !drawCanvasRef.current) return;
    const dataUrl = drawCanvasRef.current.toDataURL('image/png');
    setBaseFrames(prev => prev.map(f=>f.id===selectedBase ? {...f, drawing:dataUrl} : f));
  }

  // ── Assign image — stores url + resets position ───────────────
  function assignImageToFrame(file) {
    if (!file || !file.type.startsWith('image/') || !selectedBase) return;
    const url = URL.createObjectURL(file);
    setBaseFrames(prev => prev.map(f=>f.id===selectedBase ? {...f, imageUrl:url, x:0, y:0, scale:1} : f));
  }
  function handleFileChange(e) { assignImageToFrame(e.target.files?.[0]); e.target.value=''; }

  // ── Mouse: MOVE tool ──────────────────────────────────────────
  function onMoveDown(e) {
    if (tool!=='move' || !selectedBase) return;
    const frame = baseFrames.find(f=>f.id===selectedBase);
    if (!frame?.imageUrl) return;
    imgDragRef.current = { startX:e.clientX, startY:e.clientY, origX:frame.x||0, origY:frame.y||0 };
    e.preventDefault();
  }
  function onMoveMove(e) {
    if (!imgDragRef.current || !selectedBase) return;
    const dx = e.clientX - imgDragRef.current.startX;
    const dy = e.clientY - imgDragRef.current.startY;
    setBaseFrames(prev => prev.map(f=>
      f.id===selectedBase ? {...f, x:imgDragRef.current.origX+dx, y:imgDragRef.current.origY+dy} : f
    ));
  }
  function onMoveUp() { imgDragRef.current = null; }

  // ── Mouse: PENCIL / ERASER tool ──────────────────────────────
  function getDrawPos(e) {
    const canvas = drawCanvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left)  / rect.width)  * DRAW_W,
      y: ((e.clientY - rect.top)   / rect.height) * DRAW_H,
    };
  }

  function onDrawDown(e) {
    if ((tool!=='pencil' && tool!=='eraser') || !selectedBase) return;

    // Eraser: if frame has an image, merge it into the drawing canvas first
    if (tool === 'eraser') {
      const frame = baseFrames.find(f => f.id === selectedBase);
      if (frame?.imageUrl) {
        const canvas = drawCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          // Replicate objectFit:contain sizing
          const imgAspect = img.naturalWidth / img.naturalHeight;
          const canvasAspect = DRAW_W / DRAW_H;
          let dw, dh, dx, dy;
          if (imgAspect > canvasAspect) {
            dw = DRAW_W; dh = DRAW_W / imgAspect;
          } else {
            dh = DRAW_H; dw = DRAW_H * imgAspect;
          }
          dx = (DRAW_W - dw) / 2;
          dy = (DRAW_H - dh) / 2;

          // Apply user translate/scale (convert CSS px → canvas px)
          const rect = drawCanvasRef.current.getBoundingClientRect();
          const rx = DRAW_W / rect.width;
          const ry = DRAW_H / rect.height;
          const scale = frame.scale || 1;
          const tx = (frame.x || 0) * rx;
          const ty = (frame.y || 0) * ry;

          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.translate(DRAW_W / 2 + tx, DRAW_H / 2 + ty);
          ctx.scale(scale, scale);
          ctx.translate(-DRAW_W / 2, -DRAW_H / 2);
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.restore();
          ctx.globalCompositeOperation = 'source-over';
        };
        img.src = frame.imageUrl;
        // Remove the <img> tag — image is now part of the canvas
        setBaseFrames(prev => prev.map(f =>
          f.id === selectedBase ? { ...f, imageUrl: null } : f
        ));
      }
    }

    isDrawingRef.current = true;
    lastPosRef.current   = getDrawPos(e);
    e.preventDefault();
  }
  function onDrawMove(e) {
    if (!isDrawingRef.current) return;
    const canvas = drawCanvasRef.current;
    const ctx    = canvas.getContext('2d');
    const pos    = getDrawPos(e);
    ctx.lineWidth   = pencilSize * (DRAW_W / drawCanvasRef.current.getBoundingClientRect().width);
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    if (tool==='eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = pencilColor;
    }
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
  }
  function onDrawUp() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPosRef.current   = null;
    saveDrawing();
  }

  // ── Wheel: zoom ───────────────────────────────────────────────
  function onWheel(e) {
    if (tool!=='move' || !selectedBase) return;
    e.preventDefault();
    const d = e.deltaY > 0 ? -0.07 : 0.07;
    setBaseFrames(prev => prev.map(f=>
      f.id===selectedBase ? {...f, scale:clamp((f.scale||1)+d, 0.05, 8)} : f
    ));
  }

  // Unified mouse handlers dispatching to correct tool
  function onMouseDown(e) { onMoveDown(e); onDrawDown(e); }
  function onMouseMove(e) { onMoveMove(e); onDrawMove(e); }
  function onMouseUp(e)   { onMoveUp();    onDrawUp(); }

  // ── Char/bg clip ops ──────────────────────────────────────────
  function addClip(lid, at) {
    setClips(prev => {
      const ex = prev[lid]||[];
      if(ex.some(c=>at>=c.start&&at<c.start+c.duration)) return prev;
      return {...prev, [lid]:[...ex, {id:uid(), start:at, duration:4, imageUrl:null}]};
    });
  }
  function updateClip(lid, cid, p) {
    setClips(prev=>({...prev, [lid]:(prev[lid]||[]).map(c=>c.id===cid?{...c,...p}:c)}));
  }
  function deleteClip(lid, cid) {
    setClips(prev=>({...prev, [lid]:(prev[lid]||[]).filter(c=>c.id!==cid)}));
  }

  if (loading) return (
    <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f172a',color:'#475569',fontFamily:'Inter,sans-serif'}}>Loading…</div>
  );

  const charSlots = Array.from({length:MAX_SLOTS},(_,i)=>i+1).filter(n=>getSlot('character',n));
  const bgSlots   = Array.from({length:MAX_SLOTS},(_,i)=>i+1).filter(n=>getSlot('background',n));
  const charLayers = charSlots.length>0
    ? charSlots.map(n=>({id:`char-${n}`,type:'character',num:n,label:getSlot('character',n)?.name||`Character ${n}`,color:'#38bdf8',slot:getSlot('character',n)}))
    : [{id:'char-ph',type:'character',isEmpty:true,label:'+ Add Character',color:'#38bdf8'}];
  const bgLayers = bgSlots.length>0
    ? bgSlots.map(n=>({id:`bg-${n}`,type:'background',num:n,label:getSlot('background',n)?.name||`Background ${n}`,color:'#34d399',slot:getSlot('background',n)}))
    : [{id:'bg-ph',type:'background',isEmpty:true,label:'+ Add Background',color:'#34d399'}];

  const totalVisible = Math.max(baseFrames.length+4, 30);
  const curFrame  = baseFrames.find(f=>f.id===selectedBase);
  const cursorMap = { move: curFrame?.imageUrl?(imgDragRef.current?'grabbing':'grab'):(selectedBase?'pointer':'default'), pencil:'crosshair', eraser:'cell' };

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',fontFamily:'Inter,system-ui,sans-serif',overflow:'hidden',background:'#0f172a'}}>

      {/* ── TOP BAR ── */}
      <div style={{height:'44px',background:'#020617',borderBottom:'1px solid #1e293b',display:'flex',alignItems:'center',paddingInline:'14px',gap:'10px',flexShrink:0}}>
        <Link to="/" style={{textDecoration:'none',display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{fontSize:'17px'}}>🎬</span>
          <span style={{fontWeight:800,fontSize:'13px',color:'#f8fafc'}}>Macrometro <span style={{color:'#38bdf8'}}>Animation</span></span>
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
            BASE <span style={{color:'#818cf8',fontWeight:700}}>{baseFrames.length}</span>f
          </span>
          <Link to={`/project/${id}/upload`}
            style={{background:'#38bdf8',color:'#0f172a',fontWeight:700,fontSize:'12px',padding:'6px 14px',borderRadius:'6px',textDecoration:'none',boxShadow:'0 0 12px rgba(56,189,248,0.3)'}}>
            ▶ Upload & Process
          </Link>
        </div>
      </div>

      {/* ── WORKSPACE: toolbar + canvas ── */}
      <div style={{flex:1,display:'flex',minHeight:0,overflow:'hidden'}}>

        {/* ── LEFT TOOLBAR ── */}
        <div style={{width:'48px',background:'#020617',borderRight:'1px solid #0f172a',display:'flex',flexDirection:'column',alignItems:'center',paddingTop:'10px',gap:'4px',flexShrink:0}}>
          {[
            { id:'move',   icon:'✥', title:'Mover (V)' },
            { id:'pencil', icon:'✏', title:'Lápiz (P)' },
            { id:'eraser', icon:'◻', title:'Borrador (E)' },
          ].map(t => (
            <button key={t.id} title={t.title} onClick={()=>setTool(t.id)}
              style={{
                width:'36px', height:'36px', borderRadius:'6px', border:'none', cursor:'pointer',
                fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center',
                background: tool===t.id ? 'rgba(56,189,248,0.2)' : 'transparent',
                color:       tool===t.id ? '#38bdf8' : '#475569',
                boxShadow:   tool===t.id ? 'inset 0 0 0 1px #38bdf8' : 'none',
                transition:'all .1s',
              }}>
              {t.icon}
            </button>
          ))}

          {/* Load image button */}
          <label title="Cargar imagen al frame seleccionado"
            style={{width:'36px',height:'36px',borderRadius:'6px',cursor: selectedBase?'pointer':'not-allowed',
              background: selectedBase?'rgba(129,140,248,0.15)':'transparent',
              border:'none', display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:'16px', color: selectedBase?'#818cf8':'#1e293b',
              boxShadow: selectedBase?'inset 0 0 0 1px rgba(129,140,248,0.4)':'none',
            }}>
            <input type="file" accept="image/*" style={{display:'none'}}
              onChange={e=>{ assignImageToFrame(e.target.files?.[0]); e.target.value=''; }}
              disabled={!selectedBase}/>
            🖼
          </label>

          {/* Separator */}
          <div style={{width:'28px',height:'1px',background:'#0f172a',margin:'4px 0'}}/>

          {/* Color picker (pencil only) */}
          {tool==='pencil' && (
            <label title="Color" style={{width:'28px',height:'28px',borderRadius:'50%',overflow:'hidden',cursor:'pointer',border:'2px solid #334155',flexShrink:0}}>
              <input type="color" value={pencilColor} onChange={e=>setPencilColor(e.target.value)}
                style={{opacity:0,width:'100%',height:'100%',cursor:'pointer'}}/>
              <div style={{width:'28px',height:'28px',borderRadius:'50%',background:pencilColor,marginTop:'-100%'}}/>
            </label>
          )}

          {/* Size */}
          {(tool==='pencil'||tool==='eraser') && (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',paddingTop:'4px'}}>
              {[2,6,12,20].map(s=>(
                <button key={s} onClick={()=>setPencilSize(s)} title={`${s}px`}
                  style={{width:clamp(s+8,14,32),height:clamp(s+8,14,32),borderRadius:'50%',border:'none',cursor:'pointer',
                    background: pencilSize===s ? '#38bdf8' : '#1e293b',
                    transition:'all .1s',flexShrink:0}}/>
              ))}
            </div>
          )}
        </div>

        {/* ── CANVAS AREA ── */}
        <div style={{flex:1,background:'#1a2235',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}}>
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFileChange}/>

          {/* White canvas */}
          <div
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
            onDragOver={e=>{e.preventDefault();setCanvasOver(true);}}
            onDragLeave={()=>setCanvasOver(false)}
            onDrop={e=>{e.preventDefault();setCanvasOver(false);assignImageToFrame(e.dataTransfer.files?.[0]);}}
            style={{
              background: '#ffffff',
              outline: canvasOver ? '3px solid #38bdf8' : 'none',
              aspectRatio:'16/9',
              maxHeight:'calc(100% - 20px)',
              maxWidth:'calc(100% - 20px)',
              width:'min(calc(100% - 20px), calc((100vh - 44px - 210px) * 16/9))',
              position:'relative',
              overflow:'hidden',
              cursor: cursorMap[tool],
              userSelect:'none',
            }}
          >
            {/* Grid lines (always visible) */}
            <div style={{position:'absolute',inset:0,pointerEvents:'none',
              backgroundImage:'linear-gradient(#f1f5f9 1px,transparent 1px),linear-gradient(90deg,#f1f5f9 1px,transparent 1px)',
              backgroundSize:'64px 64px'}}/>

            {/* Image layer — movable with transform */}
            {curFrame?.imageUrl && (
              <img
                src={curFrame.imageUrl}
                alt="frame"
                draggable={false}
                style={{
                  position:'absolute',
                  width:'100%', height:'100%',
                  objectFit:'contain',
                  transform:`translate(${curFrame.x||0}px,${curFrame.y||0}px) scale(${curFrame.scale||1})`,
                  transformOrigin:'center center',
                  pointerEvents:'none',
                  willChange:'transform',
                  backfaceVisibility:'hidden',
                }}
              />
            )}

            {/* Drawing layer — transparent canvas on top */}
            <canvas
              ref={drawCanvasRef}
              width={DRAW_W}
              height={DRAW_H}
              style={{
                position:'absolute', inset:0,
                width:'100%', height:'100%',
                pointerEvents:'none',
              }}
            />

            {/* Empty state text */}
            {!curFrame?.imageUrl && (
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                <div style={{textAlign:'center'}}>
                  <p style={{color:'#94a3b8',fontSize:'11px',fontFamily:'monospace',marginBottom:'6px'}}>1920 × 1080</p>
                  <p style={{color:'#64748b',fontSize:'13px',fontWeight:600,marginBottom:'4px'}}>{project.name}</p>
                  {selectedBase
                    ? <p style={{color:'#38bdf8',fontSize:'12px'}}>Click aquí para cargar imagen</p>
                    : <p style={{color:'#94a3b8',fontSize:'12px'}}>Presiona <b style={{color:'#818cf8'}}>+</b> en BASE para agregar un frame</p>
                  }
                </div>
              </div>
            )}

            {/* Frame badge */}
            {selectedBase && (
              <div style={{position:'absolute',bottom:'6px',right:'8px',background:'rgba(0,0,0,0.1)',borderRadius:'3px',padding:'2px 7px',fontSize:'9px',color:'#94a3b8',fontFamily:'monospace',zIndex:20,pointerEvents:'none'}}>
                {String((baseFrames.findIndex(f=>f.id===selectedBase))+1).padStart(4,'0')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TIMELINE ── */}
      <div style={{background:'#020617',borderTop:'2px solid #000',flexShrink:0}}>
        {/* Ruler header */}
        <div style={{height:'24px',background:'#000',display:'flex',borderBottom:'1px solid #0f172a'}}>
          <div style={{width:`${NAME_COL}px`,flexShrink:0,borderRight:'1px solid #0f172a',display:'flex',alignItems:'center',justifyContent:'space-between',paddingInline:'8px'}}>
            <span style={{color:'#1e293b',fontSize:'9px',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}>Layers</span>
            <div style={{display:'flex',gap:'3px'}}>
              {usedSlots('character')<MAX_SLOTS &&
                <button onClick={()=>{const n=nextFree('character');if(n)setModal({type:'character',slotNumber:n,slot:null});}}
                  style={{background:'rgba(56,189,248,0.1)',border:'1px solid rgba(56,189,248,0.2)',color:'#38bdf8',fontSize:'9px',fontWeight:700,padding:'1px 5px',borderRadius:'3px',cursor:'pointer'}}>👤+</button>
              }
              {usedSlots('background')<MAX_SLOTS &&
                <button onClick={()=>{const n=nextFree('background');if(n)setModal({type:'background',slotNumber:n,slot:null});}}
                  style={{background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.2)',color:'#34d399',fontSize:'9px',fontWeight:700,padding:'1px 5px',borderRadius:'3px',cursor:'pointer'}}>🌄+</button>
              }
            </div>
          </div>
          <div style={{flex:1,overflowX:'hidden',display:'flex',alignItems:'flex-end',paddingBottom:'2px'}}>
            {Array.from({length:totalVisible},(_,i)=>(
              <div key={i} style={{width:`${FRAME_W}px`,flexShrink:0,textAlign:'center',
                fontSize:'8px',fontFamily:'monospace',color:'#334155',
                borderLeft:i%5===0?'1px solid #0f172a':'none'}}>
                {i%5===0?String(i+1).padStart(2,'0'):''}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div style={{overflowY:'auto',maxHeight:'168px'}}>
          <BaseRow frames={baseFrames} selectedId={selectedBase} frameW={FRAME_W} rowH={ROW_H}
            nameColW={NAME_COL} totalVisible={totalVisible}
            onSelect={setSelectedBase} onAdd={addBaseFrame} onDelete={deleteBaseFrame}/>
          {charLayers.map(l=>(
            <ClipRow key={l.id} layer={l} frameW={FRAME_W} rowH={ROW_H} nameColW={NAME_COL} totalVisible={totalVisible}
              clips={clips[l.id]||[]}
              onClipAdd={f=>addClip(l.id,f)} onClipUpdate={(c,p)=>updateClip(l.id,c,p)} onClipDelete={c=>deleteClip(l.id,c)}
              onLayerClick={()=>{if(l.isEmpty){const n=nextFree('character');if(n)setModal({type:'character',slotNumber:n,slot:null});}}}
              onLayerEdit={()=>l.slot&&setModal({type:'character',slotNumber:l.num,slot:l.slot})}
              onLayerDelete={()=>handleDelete('character',l.num)}/>
          ))}
          {bgLayers.map(l=>(
            <ClipRow key={l.id} layer={l} frameW={FRAME_W} rowH={ROW_H} nameColW={NAME_COL} totalVisible={totalVisible}
              clips={clips[l.id]||[]}
              onClipAdd={f=>addClip(l.id,f)} onClipUpdate={(c,p)=>updateClip(l.id,c,p)} onClipDelete={c=>deleteClip(l.id,c)}
              onLayerClick={()=>{if(l.isEmpty){const n=nextFree('background');if(n)setModal({type:'background',slotNumber:n,slot:null});}}}
              onLayerEdit={()=>l.slot&&setModal({type:'background',slotNumber:l.num,slot:l.slot})}
              onLayerDelete={()=>handleDelete('background',l.num)}/>
          ))}
        </div>
      </div>

      {modal && <SlotModal slot={modal.slot} slotType={modal.type} onSave={handleSave} onClose={()=>setModal(null)}/>}
    </div>
  );
}

/* ── BASE ROW ──────────────────────────────────────────────── */
function BaseRow({ frames, selectedId, frameW, rowH, nameColW, totalVisible, onSelect, onAdd, onDelete }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{display:'flex',height:`${rowH}px`,borderBottom:'1px solid #0a0f1a',flexShrink:0,background:hov?'#050a14':'#020617'}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <div style={{width:`${nameColW}px`,flexShrink:0,borderRight:'1px solid #0f172a',display:'flex',alignItems:'center',overflow:'hidden'}}>
        <div style={{width:'3px',alignSelf:'stretch',flexShrink:0,background:'#818cf855'}}/>
        <div style={{flex:1,paddingInline:'8px',display:'flex',alignItems:'center',gap:'6px'}}>
          <span style={{fontSize:'12px'}}>🎞️</span>
          <span style={{fontSize:'11px',fontWeight:700,color:'#818cf8'}}>BASE</span>
          <span style={{fontSize:'10px',color:'#334155',fontFamily:'monospace'}}>{frames.length}f</span>
        </div>
        <button onClick={onAdd} title="Add frame"
          style={{marginRight:'8px',background:'#818cf8',border:'none',color:'#fff',fontWeight:900,fontSize:'14px',
            width:'20px',height:'20px',borderRadius:'4px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,lineHeight:1}}>
          +
        </button>
      </div>
      <div style={{flex:1,overflowX:'hidden',position:'relative',display:'flex',alignItems:'center'}}>
        {Array.from({length:totalVisible},(_,i)=>(
          <div key={i} style={{width:`${frameW}px`,height:'100%',flexShrink:0,
            borderRight:i%5===4?'1px solid #0f172a':'1px solid #070d18'}}/>
        ))}
        {frames.map((frame,idx)=>{
          const isSel = frame.id===selectedId;
          return (
            <div key={frame.id}
              onClick={()=>onSelect(frame.id)}
              onDoubleClick={()=>onDelete(frame.id)}
              title={`Frame ${idx+1} — click=select, dblclick=delete`}
              style={{
                position:'absolute', left:`${idx*frameW+2}px`, top:'4px', bottom:'4px',
                width:`${frameW-4}px`,
                background: isSel ? 'rgba(129,140,248,0.5)' : (frame.imageUrl||frame.drawing ? 'rgba(129,140,248,0.25)' : 'rgba(129,140,248,0.12)'),
                border:`2px solid ${isSel?'#818cf8':'rgba(129,140,248,0.3)'}`,
                borderRadius:'3px', cursor:'pointer', overflow:'hidden',
                display:'flex', alignItems:'center', justifyContent:'center', zIndex:5,
                boxShadow: isSel?'0 0 8px #818cf880':'none',
              }}>
              {frame.imageUrl
                ? <img src={frame.imageUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover',pointerEvents:'none'}}/>
                : <span style={{fontSize:'8px',color:'#818cf8',opacity:.7,fontFamily:'monospace'}}>{String(idx+1).padStart(3,'0')}</span>
              }
              {/* drawing indicator */}
              {frame.drawing && !frame.imageUrl && (
                <div style={{position:'absolute',inset:0,background:'rgba(129,140,248,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:'10px'}}>✏</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── CLIP ROW ──────────────────────────────────────────────── */
function ClipRow({ layer, frameW, rowH, nameColW, totalVisible, clips, onClipAdd, onClipUpdate, onClipDelete, onLayerClick, onLayerEdit, onLayerDelete }) {
  const [hov, setHov]         = useState(false);
  const [dragging, setDragging] = useState(null);
  const trackRef = useRef();

  useEffect(() => {
    if (!dragging) return;
    function onMove(e) {
      const df = Math.round((e.clientX-dragging.startX)/frameW);
      if (dragging.mode==='move') onClipUpdate(dragging.clipId,{start:clamp(dragging.origStart+df,1,totalVisible)});
      else onClipUpdate(dragging.clipId,{duration:clamp(dragging.origDur+df,1,totalVisible-dragging.origStart+1)});
    }
    function onUp() { setDragging(null); }
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
    return ()=>{ window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
  }, [dragging,frameW,totalVisible,onClipUpdate]);

  return (
    <div style={{display:'flex',height:`${rowH}px`,borderBottom:'1px solid #0a0f1a',flexShrink:0,background:hov?'#050a14':'#020617'}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
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
              style={{background:'transparent',border:'none',color:layer.color,fontSize:'9px',cursor:'pointer',padding:'2px 5px',borderRadius:'3px',fontWeight:700}}>Edit</button>
            <button onClick={e=>{e.stopPropagation();onLayerDelete();}}
              style={{background:'transparent',border:'none',color:'#ef4444',fontSize:'9px',cursor:'pointer',padding:'2px 5px',borderRadius:'3px',fontWeight:700}}>✕</button>
          </div>
        )}
      </div>
      <div ref={trackRef} style={{flex:1,overflowX:'hidden',position:'relative'}}
        onDoubleClick={e=>{
          if(layer.isEmpty) return;
          const rect=trackRef.current.getBoundingClientRect();
          const f=clamp(Math.floor((e.clientX-rect.left)/frameW)+1,1,totalVisible);
          onClipAdd(f);
        }}>
        {Array.from({length:totalVisible},(_,i)=>(
          <div key={i} style={{position:'absolute',left:`${i*frameW}px`,top:0,bottom:0,width:`${frameW}px`,
            borderRight:i%5===4?'1px solid #0f172a':'1px solid #070d18',
            background:i%2===0?'#020617':'#030812'}}/>
        ))}
        {clips.map(clip=>(
          <ClipBlock key={clip.id} clip={clip} frameW={frameW} color={layer.color}
            onMoveStart={e=>{e.stopPropagation();setDragging({clipId:clip.id,mode:'move',startX:e.clientX,origStart:clip.start,origDur:clip.duration});}}
            onResizeStart={e=>{e.stopPropagation();setDragging({clipId:clip.id,mode:'resize',startX:e.clientX,origStart:clip.start,origDur:clip.duration});}}
            onDelete={()=>onClipDelete(clip.id)}/>
        ))}
      </div>
    </div>
  );
}

/* ── CLIP BLOCK ────────────────────────────────────────────── */
function ClipBlock({ clip, frameW, color, onMoveStart, onResizeStart, onDelete }) {
  const [hov, setHov] = useState(false);
  const left  = (clip.start-1)*frameW;
  const width = clip.duration*frameW-2;
  return (
    <div style={{position:'absolute',top:'4px',bottom:'4px',left:`${left}px`,width:`${width}px`,
      background:`${color}25`,border:`2px solid ${color}55`,borderRadius:'3px',zIndex:10,overflow:'hidden',cursor:'grab'}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onMouseDown={onMoveStart}>
      <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:'3px',paddingInline:'4px'}}>
        {Array.from({length:Math.min(clip.duration,12)},(_,i)=>(
          <div key={i} style={{width:'4px',height:'4px',borderRadius:'50%',background:color,opacity:.6,flexShrink:0}}/>
        ))}
      </div>
      {width>34 && <span style={{position:'absolute',top:'2px',left:'4px',fontSize:'8px',fontFamily:'monospace',color,fontWeight:700,opacity:.8}}>{clip.duration}f</span>}
      {hov && <button onClick={e=>{e.stopPropagation();onDelete();}}
        style={{position:'absolute',top:'1px',right:'10px',background:'#ef4444',border:'none',color:'#fff',fontSize:'8px',fontWeight:700,padding:'0 3px',borderRadius:'2px',cursor:'pointer',zIndex:20,lineHeight:'13px'}}>✕</button>}
      <div style={{position:'absolute',right:0,top:0,bottom:0,width:'7px',cursor:'ew-resize',background:`${color}20`,display:'flex',alignItems:'center',justifyContent:'center'}}
        onMouseDown={e=>{e.stopPropagation();onResizeStart(e);}}>
        <div style={{width:'2px',height:'10px',background:color,borderRadius:'1px',opacity:.8}}/>
      </div>
    </div>
  );
}
