import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, slotsApi } from '../api';
import SlotModal from '../components/SlotModal';

const MAX_SLOTS    = 5;
const FRAME_W      = 36;
const FRAME_H      = 32;
const NAME_COL     = 180;
const TOTAL_FRAMES = 24;

export default function Project() {
  const { id } = useParams();
  const [project, setProject]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);
  const [selected, setSelected]   = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

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
    if (!confirm('Remove this layer?')) return;
    if (type === 'character') await slotsApi.deleteCharacter(id, num);
    else await slotsApi.deleteBackground(id, num);
    if (selected?.type === type && selected?.num === num) setSelected(null);
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

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#e8eaed', fontFamily:'Inter,sans-serif', color:'#888' }}>
      Loading…
    </div>
  );

  // Build timeline rows — always at least 1 char + 1 bg
  const usedChars = Array.from({ length: MAX_SLOTS }, (_, i) => i + 1).filter(n => getSlot('character', n));
  const usedBgs   = Array.from({ length: MAX_SLOTS }, (_, i) => i + 1).filter(n => getSlot('background', n));

  const charRows = usedChars.length > 0
    ? usedChars.map(n => ({ key:`c${n}`, type:'character', num:n, slot:getSlot('character', n) }))
    : [{ key:'c_empty', type:'character', num:null, slot:null, isEmpty:true }];

  const bgRows = usedBgs.length > 0
    ? usedBgs.map(n => ({ key:`b${n}`, type:'background', num:n, slot:getSlot('background', n) }))
    : [{ key:'b_empty', type:'background', num:null, slot:null, isEmpty:true }];

  const allRows = [
    { key:'base', type:'base', label:'BASE', color:'#818cf8' },
    ...charRows.map(r => ({ ...r, label: r.slot?.name || '+ Add Character', color:'#38bdf8' })),
    ...bgRows.map(r  => ({ ...r, label: r.slot?.name || '+ Add Background', color:'#34d399' })),
  ];

  const selSlot = selected?.slot;

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', fontFamily:'Inter,system-ui,sans-serif', overflow:'hidden', color:'#1e293b', background:'#d1d5db' }}>

      {/* ── TOP BAR ──────────────────────────────── */}
      <div style={{ height:'46px', background:'#1e293b', display:'flex', alignItems:'center', paddingInline:'16px', gap:'12px', flexShrink:0, zIndex:10 }}>
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:'8px', textDecoration:'none' }}>
          <span style={{ fontSize:'18px' }}>🎬</span>
          <span style={{ fontWeight:800, fontSize:'13px', color:'#fff', letterSpacing:'-0.3px' }}>
            Macrometro <span style={{ color:'#38bdf8' }}>Animation</span>
          </span>
        </Link>
        <span style={{ width:'1px', height:'16px', background:'#334155' }}/>
        {editingName
          ? <input autoFocus value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={saveName} onKeyDown={e => e.key === 'Enter' && saveName()}
              style={{ background:'transparent', border:'none', borderBottom:'1px solid #38bdf8', outline:'none', color:'#fff', fontWeight:600, fontSize:'13px', width:'180px' }}/>
          : <button onClick={() => setEditingName(true)}
              style={{ background:'none', border:'none', color:'#e2e8f0', fontWeight:600, fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', padding:0 }}>
              {project.name} <span style={{ color:'#475569', fontSize:'11px' }}>✏</span>
            </button>
        }
        <div style={{ marginLeft:'auto', display:'flex', gap:'8px', alignItems:'center' }}>
          <Link to={`/project/${id}/upload`}
            style={{ background:'#38bdf8', color:'#fff', fontWeight:700, fontSize:'12px', padding:'6px 16px', borderRadius:'7px', textDecoration:'none', boxShadow:'0 0 12px rgba(56,189,248,0.5)' }}>
            ▶ Upload & Process
          </Link>
        </div>
      </div>

      {/* ── CANVAS AREA ──────────────────────────── */}
      {/* Gray "desk" around the canvas */}
      <div style={{ flex:1, background:'#9ca3af', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', minHeight:0, position:'relative' }}>

        {/* The actual 16:9 canvas — white sheet of paper */}
        <div style={{
          background:'#ffffff',
          boxShadow:'0 8px 40px rgba(0,0,0,0.35)',
          borderRadius:'2px',
          aspectRatio:'16/9',
          maxHeight:'100%',
          maxWidth:'100%',
          width:'min(100%, calc(100vh * 16/9 - 80px))',
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          position:'relative',
          overflow:'hidden',
        }}>
          {/* Subtle grid inside canvas */}
          <div style={{
            position:'absolute', inset:0,
            backgroundImage:'linear-gradient(#f1f5f9 1px,transparent 1px),linear-gradient(90deg,#f1f5f9 1px,transparent 1px)',
            backgroundSize:'80px 80px',
          }}/>

          {/* Canvas content */}
          <div style={{ position:'relative', zIndex:1, textAlign:'center', padding:'20px' }}>
            {selSlot?.reference_image_url ? (
              <div>
                <img
                  src={`${import.meta.env.VITE_API_URL || ''}/api/download?key=${encodeURIComponent(selSlot.reference_image_url)}`}
                  alt={selSlot.name}
                  style={{ maxHeight:'60%', maxWidth:'80%', display:'block', margin:'0 auto', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}
                />
                <p style={{ color:'#1e293b', fontWeight:700, marginTop:'12px', fontSize:'14px' }}>{selSlot.name}</p>
              </div>
            ) : selSlot ? (
              <div>
                <div style={{ fontSize:'48px', opacity:.15, marginBottom:'12px' }}>{selected.type === 'character' ? '👤' : '🌄'}</div>
                <p style={{ color:'#1e293b', fontWeight:700, fontSize:'16px', marginBottom:'6px' }}>{selSlot.name}</p>
                <p style={{ color:'#94a3b8', fontSize:'12px', marginBottom:'16px' }}>{selSlot.description || 'No description'}</p>
                <button onClick={() => setModal({ type:selected.type, slotNumber:selected.num, slot:selSlot })}
                  style={{ background:'#38bdf8', color:'#fff', fontWeight:700, fontSize:'12px', padding:'8px 18px', borderRadius:'7px', border:'none', cursor:'pointer' }}>
                  + Upload Reference Image
                </button>
              </div>
            ) : (
              <div>
                <p style={{ color:'#94a3b8', fontSize:'13px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.1em' }}>1920 × 1080</p>
                <p style={{ color:'#1e293b', fontSize:'22px', fontWeight:800, marginBottom:'6px' }}>{project.name}</p>
                <p style={{ color:'#94a3b8', fontSize:'12px', marginBottom:'20px' }}>
                  Click a layer in the timeline to configure it
                </p>
                <Link to={`/project/${id}/upload`}
                  style={{ background:'#38bdf8', color:'#fff', fontWeight:700, fontSize:'13px', padding:'10px 24px', borderRadius:'8px', textDecoration:'none', boxShadow:'0 4px 12px rgba(56,189,248,0.4)', display:'inline-block' }}>
                  Upload Frames →
                </Link>
              </div>
            )}
          </div>

          {/* Resolution badge */}
          <div style={{ position:'absolute', bottom:'10px', right:'12px', background:'rgba(0,0,0,0.06)', borderRadius:'4px', padding:'2px 8px', fontSize:'10px', color:'#94a3b8', fontFamily:'monospace' }}>
            1920 × 1080
          </div>
        </div>
      </div>

      {/* ── TIMELINE ─────────────────────────────── */}
      <div style={{ background:'#1e293b', flexShrink:0, borderTop:'2px solid #0f172a' }}>

        {/* Header row */}
        <div style={{ height:'30px', background:'#0f172a', display:'flex', alignItems:'stretch', borderBottom:'1px solid #1e293b' }}>
          <div style={{ width:`${NAME_COL}px`, flexShrink:0, borderRight:'1px solid #334155', display:'flex', alignItems:'center', justifyContent:'space-between', paddingInline:'10px' }}>
            <span style={{ color:'#475569', fontSize:'10px', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>Layers</span>
            <div style={{ display:'flex', gap:'3px' }}>
              {usedCount('character') < MAX_SLOTS &&
                <button onClick={() => { const n=nextFree('character'); if(n) setModal({type:'character',slotNumber:n,slot:null}); }}
                  style={{ background:'rgba(56,189,248,0.15)', border:'1px solid rgba(56,189,248,0.3)', color:'#38bdf8', fontSize:'10px', fontWeight:700, padding:'1px 7px', borderRadius:'4px', cursor:'pointer' }}>
                  👤 +
                </button>
              }
              {usedCount('background') < MAX_SLOTS &&
                <button onClick={() => { const n=nextFree('background'); if(n) setModal({type:'background',slotNumber:n,slot:null}); }}
                  style={{ background:'rgba(52,211,153,0.15)', border:'1px solid rgba(52,211,153,0.3)', color:'#34d399', fontSize:'10px', fontWeight:700, padding:'1px 7px', borderRadius:'4px', cursor:'pointer' }}>
                  🌄 +
                </button>
              }
            </div>
          </div>
          {/* Frame numbers */}
          <div style={{ flex:1, overflowX:'hidden', display:'flex', alignItems:'center', paddingInline:'4px', gap:'0' }}>
            {Array.from({ length: TOTAL_FRAMES }, (_, i) => (
              <div key={i} style={{ width:`${FRAME_W}px`, flexShrink:0, textAlign:'center', fontSize:'9px', fontFamily:'monospace', color:'#334155', fontWeight:600 }}>
                {(i % 5 === 0) ? String(i + 1).padStart(2, '0') : '·'}
              </div>
            ))}
            <span style={{ color:'#334155', fontSize:'11px', paddingLeft:'4px', flexShrink:0 }}>…</span>
          </div>
        </div>

        {/* Layer rows */}
        {allRows.map(row => (
          <TLRow key={row.key} row={row}
            isSelected={selected?.key === row.key || (selected?.type === row.type && selected?.num === row.num)}
            frameCount={TOTAL_FRAMES} frameW={FRAME_W} frameH={FRAME_H} nameColW={NAME_COL}
            onClick={() => {
              if (row.isEmpty) { const n=nextFree(row.type); if(n) setModal({type:row.type,slotNumber:n,slot:null}); }
              else if (row.type !== 'base') setSelected(row);
            }}
            onEdit={() => row.slot && setModal({ type:row.type, slotNumber:row.num, slot:row.slot })}
            onDelete={() => row.slot && handleDelete(row.type, row.num)}
          />
        ))}
      </div>

      {modal && <SlotModal slot={modal.slot} slotType={modal.type} onSave={handleSave} onClose={() => setModal(null)}/>}
    </div>
  );
}

function TLRow({ row, isSelected, frameCount, frameW, frameH, nameColW, onClick, onEdit, onDelete }) {
  const [hov, setHov] = useState(false);
  const isBase  = row.type === 'base';
  const isEmpty = row.isEmpty;

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display:'flex', height:`${frameH + 8}px`, borderBottom:'1px solid #0f172a',
        background: isSelected ? `${row.color}18` : hov ? '#263247' : '#1e293b',
        transition:'background .1s', cursor: isEmpty ? 'pointer' : 'default' }}>

      {/* Name cell */}
      <div onClick={onClick}
        style={{ width:`${nameColW}px`, flexShrink:0, borderRight:'1px solid #334155', display:'flex', alignItems:'center', overflow:'hidden', cursor:'pointer', gap:0 }}>
        {/* Color strip */}
        <div style={{ width:'4px', alignSelf:'stretch', flexShrink:0, background: isSelected ? row.color : `${row.color}55` }}/>
        <div style={{ flex:1, paddingInline:'10px', display:'flex', alignItems:'center', gap:'7px', overflow:'hidden' }}>
          <span style={{ fontSize:'13px', flexShrink:0 }}>
            {isBase ? '🎞️' : row.type === 'character' ? '👤' : '🌄'}
          </span>
          <span style={{ fontSize:'12px', fontWeight: isBase || isEmpty ? 600 : 500,
            color: isEmpty ? `${row.color}88` : isSelected ? row.color : '#cbd5e1',
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            fontStyle: isEmpty ? 'italic' : 'normal' }}>
            {row.label}
          </span>
        </div>
        {hov && !isBase && !isEmpty && (
          <div style={{ display:'flex', gap:'2px', paddingRight:'6px', flexShrink:0 }}>
            <button onClick={e => { e.stopPropagation(); onEdit(); }}
              style={{ background:'rgba(56,189,248,0.15)', border:'none', color:'#38bdf8', fontSize:'10px', fontWeight:700, padding:'2px 6px', borderRadius:'3px', cursor:'pointer' }}>
              Edit
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{ background:'rgba(239,68,68,0.15)', border:'none', color:'#ef4444', fontSize:'10px', fontWeight:700, padding:'2px 5px', borderRadius:'3px', cursor:'pointer' }}>
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Frame cells */}
      <div style={{ flex:1, overflowX:'hidden', display:'flex', alignItems:'center', paddingInline:'4px', gap:'2px' }}>
        {Array.from({ length: frameCount }, (_, i) => (
          <div key={i} style={{
            width:`${frameW}px`, height:`${frameH}px`, borderRadius:'3px', flexShrink:0,
            background: isBase ? `${row.color}25` : isEmpty ? '#263247' : '#263247',
            border:`1px solid ${isSelected ? `${row.color}60` : '#334155'}`,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            {isBase && <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:row.color, opacity:.5 }}/>}
            {!isBase && !isEmpty && (
              <span style={{ color:'#334155', fontSize:'8px', fontFamily:'monospace' }}>
                {String(i+1).padStart(2,'0')}
              </span>
            )}
          </div>
        ))}
        <span style={{ color:'#334155', fontSize:'11px', paddingLeft:'4px', flexShrink:0 }}>…</span>
      </div>
    </div>
  );
}
