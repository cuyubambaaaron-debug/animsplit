import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, slotsApi } from '../api';
import SlotModal from '../components/SlotModal';

const MAX_SLOTS  = 5;
const FRAME_W    = 28;   // px per frame cell
const FRAME_H    = 28;
const NAME_COL   = 200;  // px for layer name column
const TOTAL_FRAMES = 24; // preview frames shown (empty)

const COLORS = {
  base:       '#6366f1',
  character:  '#0ea5e9',
  background: '#10b981',
};

export default function Project() {
  const { id } = useParams();
  const [project, setProject]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(null);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [editingName, setEditingName]   = useState(false);
  const [nameInput, setNameInput]       = useState('');
  const trackRef = useRef();

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      const { data } = await projectsApi.get(id);
      setProject(data);
      setNameInput(data.name);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }

  async function saveName() {
    if (!nameInput.trim() || nameInput===project.name){ setEditingName(false); return; }
    await projectsApi.update(id, nameInput.trim());
    setProject(p=>({...p, name:nameInput.trim()}));
    setEditingName(false);
  }

  async function handleSave(formData) {
    const { type, slotNumber } = modal;
    if (type==='character') await slotsApi.updateCharacter(id, slotNumber, formData);
    else await slotsApi.updateBackground(id, slotNumber, formData);
    await load();
    setModal(null);
  }

  async function handleDelete(type, num) {
    if (!confirm('Remove this layer?')) return;
    if (type==='character') await slotsApi.deleteCharacter(id, num);
    else await slotsApi.deleteBackground(id, num);
    if (selectedLayer?.type===type && selectedLayer?.num===num) setSelectedLayer(null);
    await load();
  }

  function getSlot(type, n) {
    return (type==='character' ? project?.characters : project?.backgrounds)?.find(s=>s.slot_number===n)||null;
  }

  function nextSlot(type) {
    const used = (type==='character' ? project?.characters : project?.backgrounds)||[];
    for (let i=1;i<=MAX_SLOTS;i++) if (!used.find(s=>s.slot_number===i)) return i;
    return null;
  }

  function usedSlots(type) {
    return ((type==='character' ? project?.characters : project?.backgrounds)||[]).length;
  }

  if (loading) return (
    <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8f9fb',fontFamily:'Inter,sans-serif',color:'#94a3b8'}}>
      Loading…
    </div>
  );

  const chars = Array.from({length:MAX_SLOTS},(_,i)=>i+1).filter(n=>getSlot('character',n));
  const bgs   = Array.from({length:MAX_SLOTS},(_,i)=>i+1).filter(n=>getSlot('background',n));

  // All rows in timeline order: BASE → CHARACTERS → BACKGROUNDS
  const timelineRows = [
    { id:'base',    type:'base',       label:'BASE',    color: COLORS.base,      slot: null },
    ...chars.map(n => ({ id:`char-${n}`, type:'character', label: getSlot('character',n)?.name, color: COLORS.character, slot: getSlot('character',n), num:n })),
    ...bgs.map(n  => ({ id:`bg-${n}`,   type:'background', label: getSlot('background',n)?.name, color: COLORS.background, slot: getSlot('background',n), num:n })),
  ];

  const sel = selectedLayer;
  const selSlot = sel?.slot;

  return (
    <div style={{height:'100vh', display:'flex', flexDirection:'column', background:'#f8f9fb', fontFamily:'Inter,system-ui,sans-serif', overflow:'hidden', color:'#1e293b'}}>

      {/* ══ TOP BAR ══════════════════════════════════════════ */}
      <div style={{height:'46px', background:'#ffffff', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', paddingInline:'16px', gap:'12px', flexShrink:0, boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>

        <Link to="/" style={{display:'flex',alignItems:'center',gap:'8px',textDecoration:'none'}}>
          <span style={{fontSize:'20px'}}>🎬</span>
          <span style={{fontWeight:800, fontSize:'14px', color:'#1e293b', letterSpacing:'-0.3px'}}>
            Macrometro <span style={{color:'#0ea5e9'}}>Animation</span>
          </span>
        </Link>

        <span style={{width:'1px',height:'18px',background:'#e2e8f0'}}/>

        {editingName
          ? <input autoFocus value={nameInput}
              onChange={e=>setNameInput(e.target.value)}
              onBlur={saveName} onKeyDown={e=>e.key==='Enter'&&saveName()}
              style={{border:'none',borderBottom:'2px solid #0ea5e9',outline:'none',fontWeight:700,fontSize:'14px',color:'#1e293b',background:'transparent',width:'200px'}}/>
          : <button onClick={()=>setEditingName(true)}
              style={{background:'none',border:'none',fontWeight:700,fontSize:'14px',color:'#1e293b',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',padding:0}}>
              {project.name} <span style={{color:'#94a3b8',fontSize:'12px'}}>✏</span>
            </button>
        }

        <div style={{marginLeft:'auto',display:'flex',gap:'8px',alignItems:'center'}}>
          <Link to={`/project/${id}/upload`}
            style={{background:'#0ea5e9',color:'#fff',fontWeight:700,fontSize:'13px',padding:'7px 18px',borderRadius:'8px',textDecoration:'none',boxShadow:'0 2px 8px rgba(14,165,233,0.4)'}}>
            ▶ Upload & Process
          </Link>
        </div>
      </div>

      {/* ══ CANVAS ════════════════════════════════════════════ */}
      <div style={{flex:1, background:'#ffffff', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden', minHeight:0}}>

        {/* Subtle grid */}
        <div style={{position:'absolute',inset:0,
          backgroundImage:`linear-gradient(#f1f5f9 1px,transparent 1px),linear-gradient(90deg,#f1f5f9 1px,transparent 1px)`,
          backgroundSize:'40px 40px', opacity:0.7}}/>

        {/* Canvas content */}
        <div style={{position:'relative',zIndex:1,textAlign:'center',padding:'20px',maxWidth:'80%'}}>
          {selSlot?.reference_image_url ? (
            <div>
              <img src={`${import.meta.env.VITE_API_URL||''}/api/download?key=${encodeURIComponent(selSlot.reference_image_url)}`}
                alt={selSlot.name}
                style={{maxHeight:'45vh',maxWidth:'100%',boxShadow:'0 8px 40px rgba(0,0,0,0.12)',borderRadius:'6px',display:'block',margin:'0 auto'}}/>
              <p style={{color:'#1e293b',fontWeight:700,fontSize:'15px',marginTop:'12px'}}>{selSlot.name}</p>
              {selSlot.description && <p style={{color:'#64748b',fontSize:'12px',marginTop:'3px'}}>{selSlot.description}</p>}
            </div>
          ) : selSlot ? (
            <div>
              <div style={{fontSize:'52px',marginBottom:'12px',opacity:0.2}}>{sel.type==='character'?'👤':'🌄'}</div>
              <p style={{color:'#1e293b',fontWeight:700,fontSize:'17px',marginBottom:'6px'}}>{selSlot.name}</p>
              <p style={{color:'#94a3b8',fontSize:'12px',marginBottom:'16px'}}>{selSlot.description||'No description set'}</p>
              <button onClick={()=>setModal({type:sel.type,slotNumber:sel.num,slot:selSlot})}
                style={{background:'#0ea5e9',color:'#fff',fontWeight:700,fontSize:'12px',padding:'8px 18px',borderRadius:'7px',border:'none',cursor:'pointer'}}>
                + Upload Reference Image
              </button>
            </div>
          ) : (
            <div>
              <div style={{fontSize:'60px',marginBottom:'16px',opacity:0.1}}>🎬</div>
              <p style={{color:'#1e293b',fontSize:'20px',fontWeight:800,marginBottom:'8px'}}>{project.name}</p>
              <p style={{color:'#94a3b8',fontSize:'13px',marginBottom:'24px',lineHeight:'1.6'}}>
                Click a layer in the timeline below to configure it,<br/>
                or upload frames to start processing.
              </p>
              <Link to={`/project/${id}/upload`}
                style={{background:'#0ea5e9',color:'#fff',fontWeight:700,fontSize:'14px',padding:'11px 28px',borderRadius:'10px',textDecoration:'none',boxShadow:'0 4px 14px rgba(14,165,233,0.4)',display:'inline-block'}}>
                Upload Frames & Process →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ══ TIMELINE (always at bottom) ═══════════════════════ */}
      <div style={{background:'#ffffff', borderTop:'2px solid #e2e8f0', flexShrink:0, boxShadow:'0 -2px 8px rgba(0,0,0,0.04)'}}>

        {/* Timeline toolbar */}
        <div style={{height:'34px', background:'#f8f9fb', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', gap:'0', flexShrink:0}}>
          {/* Name column header */}
          <div style={{width:`${NAME_COL}px`, flexShrink:0, borderRight:'1px solid #e2e8f0', paddingInline:'14px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'100%'}}>
            <span style={{fontSize:'10px', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#94a3b8'}}>Layers</span>
            <div style={{display:'flex', gap:'4px'}}>
              {usedSlots('character') < MAX_SLOTS && (
                <button onClick={()=>{const n=nextSlot('character');if(n)setModal({type:'character',slotNumber:n,slot:null});}}
                  style={{background:'#e0f2fe',border:'none',color:'#0ea5e9',fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'4px',cursor:'pointer'}}>
                  👤+
                </button>
              )}
              {usedSlots('background') < MAX_SLOTS && (
                <button onClick={()=>{const n=nextSlot('background');if(n)setModal({type:'background',slotNumber:n,slot:null});}}
                  style={{background:'#d1fae5',border:'none',color:'#10b981',fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'4px',cursor:'pointer'}}>
                  🌄+
                </button>
              )}
            </div>
          </div>

          {/* Frame numbers header */}
          <div ref={trackRef} style={{flex:1, overflowX:'auto', display:'flex', alignItems:'center', paddingInline:'6px', gap:'2px'}}>
            {Array.from({length:TOTAL_FRAMES},(_,i)=>(
              <div key={i} style={{width:`${FRAME_W}px`, flexShrink:0, textAlign:'center', fontSize:'9px', fontFamily:'monospace', color:'#cbd5e1', fontWeight:600}}>
                {(i+1) % 5 === 0 || i===0 ? String(i+1).padStart(2,'0') : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Layer rows */}
        <div style={{maxHeight:'160px', overflowY:'auto'}}>
          {timelineRows.map(row => {
            const isSel = sel?.id === row.id || (sel?.type===row.type && sel?.num===row.num);
            return (
              <TimelineRow
                key={row.id}
                row={row}
                isSelected={isSel}
                frameCount={TOTAL_FRAMES}
                frameW={FRAME_W}
                frameH={FRAME_H}
                nameColW={NAME_COL}
                onClick={()=>{
                  if (row.type==='base') return;
                  setSelectedLayer(row);
                }}
                onEdit={()=>{
                  if(row.type!=='base') setModal({type:row.type,slotNumber:row.num,slot:row.slot});
                }}
                onDelete={()=>{
                  if(row.type!=='base') handleDelete(row.type, row.num);
                }}
              />
            );
          })}
        </div>
      </div>

      {modal&&<SlotModal slot={modal.slot} slotType={modal.type} onSave={handleSave} onClose={()=>setModal(null)}/>}
    </div>
  );
}

function TimelineRow({ row, isSelected, frameCount, frameW, frameH, nameColW, onClick, onEdit, onDelete }) {
  const [hov, setHov] = useState(false);
  const isBase = row.type === 'base';

  return (
    <div style={{display:'flex', borderBottom:'1px solid #f1f5f9', height:'34px', flexShrink:0,
      background: isSelected ? `${row.color}10` : hov ? '#f8f9fb' : '#ffffff',
      transition:'background .1s'}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>

      {/* Layer name cell */}
      <div style={{width:`${nameColW}px`, flexShrink:0, borderRight:'1px solid #e2e8f0', display:'flex', alignItems:'center', paddingInline:'0', overflow:'hidden', cursor: isBase?'default':'pointer'}}
        onClick={onClick}>
        {/* Color strip */}
        <div style={{width:'4px', alignSelf:'stretch', background: isSelected ? row.color : `${row.color}55`, flexShrink:0}}/>
        <div style={{flex:1, paddingInline:'10px', display:'flex', alignItems:'center', gap:'7px', overflow:'hidden'}}>
          <span style={{fontSize:'13px', flexShrink:0}}>
            {isBase ? '🎞️' : row.type==='character' ? '👤' : '🌄'}
          </span>
          <span style={{fontSize:'12px', fontWeight: isBase?700:500, color: isSelected ? row.color : isBase?'#374151':'#475569',
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
            {row.label}
          </span>
        </div>
        {/* Edit/delete on hover */}
        {hov && !isBase && (
          <div style={{display:'flex', gap:'2px', paddingRight:'6px', flexShrink:0}}>
            <button onClick={e=>{e.stopPropagation();onEdit();}}
              style={{background:'#e0f2fe',border:'none',color:'#0ea5e9',fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'3px',cursor:'pointer'}}>
              Edit
            </button>
            <button onClick={e=>{e.stopPropagation();onDelete();}}
              style={{background:'#fee2e2',border:'none',color:'#ef4444',fontSize:'10px',fontWeight:700,padding:'2px 5px',borderRadius:'3px',cursor:'pointer'}}>
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Frame cells */}
      <div style={{flex:1, overflowX:'auto', display:'flex', alignItems:'center', paddingInline:'6px', gap:'2px'}}>
        {Array.from({length:frameCount},(_,i)=>(
          <div key={i} style={{
            width:`${frameW}px`, height:`${frameH-4}px`, borderRadius:'3px', flexShrink:0,
            background: isBase ? `${row.color}20` : '#f1f5f9',
            border:`1px solid ${isBase ? `${row.color}40` : '#e2e8f0'}`,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            {isBase && <div style={{width:'6px',height:'6px',borderRadius:'50%',background:row.color,opacity:0.4}}/>}
          </div>
        ))}
        <span style={{color:'#cbd5e1',fontSize:'10px',fontFamily:'monospace',marginLeft:'4px',flexShrink:0}}>…</span>
      </div>
    </div>
  );
}
