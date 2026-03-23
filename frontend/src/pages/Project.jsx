import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, slotsApi } from '../api';
import SlotModal from '../components/SlotModal';

const TOTAL_SLOTS = 8;

export default function Project() {
  const { id } = useParams();
  const [project, setProject]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editingName, setEditingName]   = useState(false);
  const [nameInput, setNameInput]       = useState('');

  useEffect(() => { loadProject(); }, [id]);

  async function loadProject() {
    try {
      const { data } = await projectsApi.get(id);
      setProject(data);
      setNameInput(data.name);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function saveName() {
    if (!nameInput.trim() || nameInput === project.name) { setEditingName(false); return; }
    try {
      await projectsApi.update(id, nameInput.trim());
      setProject(p => ({ ...p, name: nameInput.trim() }));
    } catch (e) { alert('Error'); }
    setEditingName(false);
  }

  async function handleSlotSave(data) {
    const { type, slotNumber } = modal;
    if (type === 'character') await slotsApi.updateCharacter(id, slotNumber, data);
    else await slotsApi.updateBackground(id, slotNumber, data);
    await loadProject();
    setModal(null);
  }

  async function handleSlotDelete(type, slotNumber) {
    if (!confirm('Clear this layer?')) return;
    if (type === 'character') await slotsApi.deleteCharacter(id, slotNumber);
    else await slotsApi.deleteBackground(id, slotNumber);
    if (selectedSlot?.type === type && selectedSlot?.num === slotNumber) setSelectedSlot(null);
    await loadProject();
  }

  function getSlot(type, n) {
    if (!project) return null;
    return (type === 'character' ? project.characters : project.backgrounds)
      ?.find(s => s.slot_number === n) || null;
  }

  if (loading) return (
    <div style={{ height:'100vh', background:'#080d1a', display:'flex', alignItems:'center', justifyContent:'center', color:'#4a6080', fontFamily:'Inter,sans-serif', fontSize:'13px' }}>
      Loading…
    </div>
  );

  // All layers combined for the timeline
  const allLayers = [
    ...Array.from({ length: TOTAL_SLOTS }, (_, i) => ({ type:'character', num: i+1, slot: getSlot('character', i+1) })),
    ...Array.from({ length: TOTAL_SLOTS }, (_, i) => ({ type:'background', num: i+1, slot: getSlot('background', i+1) })),
  ];

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#080d1a', fontFamily:'Inter,system-ui,sans-serif', overflow:'hidden' }}>

      {/* ══ TOP BAR ══════════════════════════════════════════ */}
      <div style={{ height:'44px', background:'#0d1526', borderBottom:'1px solid #1a2d4a', display:'flex', alignItems:'center', paddingInline:'14px', gap:'10px', flexShrink:0, zIndex:20 }}>

        <Link to="/" style={{ display:'flex', alignItems:'center', gap:'8px', textDecoration:'none', flexShrink:0 }}>
          <span style={{ fontSize:'18px' }}>🎬</span>
          <span style={{ color:'#fff', fontWeight:700, fontSize:'13px' }}>
            Macrometro <span style={{ color:'#00d4ff' }}>Animation</span>
          </span>
        </Link>

        <span style={{ width:'1px', height:'18px', background:'#1a2d4a', margin:'0 4px' }} />

        {editingName ? (
          <input autoFocus value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={saveName} onKeyDown={e => e.key==='Enter' && saveName()}
            style={{ background:'transparent', border:'none', borderBottom:'1px solid #00d4ff', color:'#fff', fontWeight:600, fontSize:'13px', outline:'none', width:'160px' }}
          />
        ) : (
          <button onClick={() => setEditingName(true)}
            style={{ background:'none', border:'none', color:'#e0f0ff', fontWeight:600, fontSize:'13px', cursor:'pointer', padding:0 }}>
            {project.name} <span style={{ color:'#2a4060', fontSize:'11px' }}>✏</span>
          </button>
        )}

        <div style={{ marginLeft:'auto', display:'flex', gap:'8px', alignItems:'center' }}>
          <Link to={`/project/${id}/upload`}
            style={{ background:'#00d4ff', color:'#080d1a', fontWeight:700, fontSize:'12px', padding:'6px 16px', borderRadius:'8px', textDecoration:'none', boxShadow:'0 0 14px rgba(0,212,255,0.4)' }}>
            + New Video
          </Link>
        </div>
      </div>

      {/* ══ MIDDLE ROW: LEFT PANEL + CANVAS ══════════════════ */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

        {/* ── LEFT PANEL ───────────────────────────────────── */}
        <div style={{ width:'230px', flexShrink:0, background:'#0a1020', borderRight:'1px solid #1a2d4a', display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Characters */}
          <div style={{ borderBottom:'1px solid #1a2d4a', flexShrink:0 }}>
            <div style={{ padding:'6px 12px', background:'#080d1a', display:'flex', alignItems:'center', gap:'6px', position:'sticky', top:0 }}>
              <span style={{ fontSize:'11px' }}>👤</span>
              <span style={{ color:'#00d4ff', fontSize:'10px', fontWeight:700, letterSpacing:'0.1em' }}>CHARACTERS</span>
            </div>
            {Array.from({ length: TOTAL_SLOTS }, (_, i) => i+1).map(num => (
              <LayerRow key={num} num={num} slot={getSlot('character', num)}
                isSelected={selectedSlot?.type==='character' && selectedSlot?.num===num}
                onClick={() => setSelectedSlot({ type:'character', num, slot: getSlot('character', num) })}
                onEdit={() => setModal({ type:'character', slotNumber:num, slot: getSlot('character', num) })}
                onDelete={() => handleSlotDelete('character', num)}
              />
            ))}
          </div>

          {/* Backgrounds */}
          <div style={{ flex:1, overflow:'auto' }}>
            <div style={{ padding:'6px 12px', background:'#080d1a', display:'flex', alignItems:'center', gap:'6px', position:'sticky', top:0, zIndex:2 }}>
              <span style={{ fontSize:'11px' }}>🌄</span>
              <span style={{ color:'#7df9ff', fontSize:'10px', fontWeight:700, letterSpacing:'0.1em' }}>BACKGROUNDS</span>
            </div>
            {Array.from({ length: TOTAL_SLOTS }, (_, i) => i+1).map(num => (
              <LayerRow key={num} num={num} slot={getSlot('background', num)}
                isSelected={selectedSlot?.type==='background' && selectedSlot?.num===num}
                onClick={() => setSelectedSlot({ type:'background', num, slot: getSlot('background', num) })}
                onEdit={() => setModal({ type:'background', slotNumber:num, slot: getSlot('background', num) })}
                onDelete={() => handleSlotDelete('background', num)}
              />
            ))}
          </div>
        </div>

        {/* ── CANVAS (WHITE) ───────────────────────────────── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Canvas toolbar */}
          <div style={{ height:'30px', background:'#0d1526', borderBottom:'1px solid #1a2d4a', display:'flex', alignItems:'center', paddingInline:'12px', gap:'10px', flexShrink:0 }}>
            <span style={{ color:'#4a6080', fontSize:'11px', fontFamily:'monospace' }}>
              {selectedSlot?.slot ? `Layer: ${selectedSlot.slot.name}` : 'Canvas View'}
            </span>
            {selectedSlot?.slot && (
              <button onClick={() => setModal({ type:selectedSlot.type, slotNumber:selectedSlot.num, slot:selectedSlot.slot })}
                style={{ marginLeft:'auto', background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.25)', color:'#00d4ff', fontSize:'10px', padding:'2px 10px', borderRadius:'5px', cursor:'pointer' }}>
                Edit Layer
              </button>
            )}
          </div>

          {/* WHITE CANVAS */}
          <div style={{ flex:1, background:'#f0f2f5', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative' }}>

            {/* Checkerboard for transparency indication */}
            <div style={{
              position:'absolute', inset:0,
              backgroundImage:`linear-gradient(45deg, #e0e3e8 25%, transparent 25%),
                linear-gradient(-45deg, #e0e3e8 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #e0e3e8 75%),
                linear-gradient(-45deg, transparent 75%, #e0e3e8 75%)`,
              backgroundSize:'20px 20px',
              backgroundPosition:'0 0, 0 10px, 10px -10px, -10px 0px',
              opacity:0.5,
            }} />

            {selectedSlot?.slot ? (
              <div style={{ position:'relative', zIndex:1, textAlign:'center', maxHeight:'100%', padding:'20px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                {selectedSlot.slot.reference_image_url ? (
                  <div>
                    <img
                      src={`${import.meta.env.VITE_API_URL || ''}/api/download?key=${encodeURIComponent(selectedSlot.slot.reference_image_url)}`}
                      alt={selectedSlot.slot.name}
                      style={{ maxHeight:'55vh', maxWidth:'100%', boxShadow:'0 8px 32px rgba(0,0,0,0.25)', borderRadius:'4px', display:'block' }}
                    />
                    <p style={{ color:'#1a2d4a', fontSize:'13px', fontWeight:600, marginTop:'12px' }}>
                      {selectedSlot.slot.name}
                    </p>
                    {selectedSlot.slot.description && (
                      <p style={{ color:'#6b7c93', fontSize:'11px', marginTop:'3px' }}>
                        {selectedSlot.slot.description}
                      </p>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:'56px', marginBottom:'14px', opacity:0.25 }}>
                      {selectedSlot.type === 'character' ? '👤' : '🌄'}
                    </div>
                    <p style={{ color:'#2a3a50', fontSize:'16px', fontWeight:700, marginBottom:'6px' }}>
                      {selectedSlot.slot.name}
                    </p>
                    <p style={{ color:'#8a9bb0', fontSize:'12px', marginBottom:'18px' }}>
                      No reference image
                    </p>
                    <button
                      onClick={() => setModal({ type:selectedSlot.type, slotNumber:selectedSlot.num, slot:selectedSlot.slot })}
                      style={{ background:'#00d4ff', color:'#080d1a', fontWeight:700, fontSize:'12px', padding:'8px 20px', borderRadius:'8px', border:'none', cursor:'pointer', boxShadow:'0 0 16px rgba(0,212,255,0.4)' }}>
                      + Upload Reference Image
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ position:'relative', zIndex:1, textAlign:'center', padding:'24px' }}>
                <div style={{ fontSize:'64px', opacity:0.15, marginBottom:'18px' }}>🎬</div>
                <p style={{ color:'#2a3a50', fontSize:'22px', fontWeight:700, marginBottom:'8px' }}>
                  {project.name}
                </p>
                <p style={{ color:'#8a9bb0', fontSize:'13px', marginBottom:'28px' }}>
                  Click a layer on the left to configure it, or upload frames to start.
                </p>
                <Link to={`/project/${id}/upload`}
                  style={{ background:'#00d4ff', color:'#080d1a', fontWeight:700, fontSize:'13px', padding:'11px 28px', borderRadius:'10px', textDecoration:'none', boxShadow:'0 0 20px rgba(0,212,255,0.45)', display:'inline-block' }}>
                  Upload Frames & Process →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ TIMELINE (ALWAYS AT BOTTOM) ════════════════════════ */}
      <div style={{ height:'160px', background:'#0a1020', borderTop:'2px solid #1a2d4a', display:'flex', flexDirection:'column', flexShrink:0 }}>

        {/* Timeline header */}
        <div style={{ height:'28px', background:'#080d1a', borderBottom:'1px solid #1a2d4a', display:'flex', alignItems:'center', flexShrink:0 }}>
          {/* Layer name column header */}
          <div style={{ width:'230px', flexShrink:0, paddingInline:'12px', borderRight:'1px solid #1a2d4a' }}>
            <span style={{ color:'#2a4060', fontSize:'10px', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.1em' }}>Layers</span>
          </div>
          {/* Frame numbers */}
          <div style={{ flex:1, overflow:'hidden', paddingInline:'8px', display:'flex', alignItems:'center', gap:'2px' }}>
            <span style={{ color:'#2a4060', fontSize:'10px', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.1em' }}>Timeline — Upload a video to begin</span>
          </div>
          {/* New video button */}
          <Link to={`/project/${id}/upload`}
            style={{ marginRight:'12px', background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.25)', color:'#00d4ff', fontSize:'10px', fontWeight:600, padding:'3px 10px', borderRadius:'5px', textDecoration:'none', flexShrink:0 }}>
            ▶ Upload
          </Link>
        </div>

        {/* Timeline rows — empty until video uploaded */}
        <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
          {allLayers.filter(l => l.slot).length === 0 ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'#1a2d4a', fontSize:'11px', fontFamily:'monospace' }}>
                No layers configured — add characters and backgrounds to get started
              </span>
            </div>
          ) : (
            allLayers.filter(l => l.slot).map(({ type, num, slot }) => (
              <div key={`${type}-${num}`}
                style={{ height:'26px', display:'flex', alignItems:'center', borderBottom:'1px solid rgba(26,45,74,0.4)', flexShrink:0 }}>
                {/* Layer name */}
                <div style={{ width:'230px', flexShrink:0, paddingInline:'12px', borderRight:'1px solid #1a2d4a', display:'flex', alignItems:'center', gap:'6px', overflow:'hidden' }}>
                  <span style={{ fontSize:'10px' }}>{type === 'character' ? '👤' : '🌄'}</span>
                  <span style={{ color:'#7a9ab8', fontSize:'11px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{slot.name}</span>
                </div>
                {/* Empty frame track */}
                <div style={{ flex:1, height:'100%', paddingInline:'8px', display:'flex', alignItems:'center', gap:'2px' }}>
                  {Array.from({ length: 40 }, (_, i) => (
                    <div key={i} style={{ width:'16px', height:'14px', borderRadius:'2px', background:'#111e35', border:'1px solid #1a2d4a', flexShrink:0 }} />
                  ))}
                  <span style={{ color:'#1a2d4a', fontSize:'9px', fontFamily:'monospace', marginLeft:'4px', flexShrink:0 }}>…</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {modal && (
        <SlotModal slot={modal.slot} slotType={modal.type}
          onSave={handleSlotSave} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function LayerRow({ num, slot, isSelected, onClick, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display:'flex', alignItems:'center', height:'30px', cursor:'pointer', borderBottom:'1px solid rgba(26,45,74,0.4)',
        background: isSelected ? 'rgba(0,212,255,0.1)' : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        transition:'background .1s' }}>

      {/* Active indicator */}
      <div style={{ width:'3px', alignSelf:'stretch', background: slot ? (isSelected ? '#00d4ff' : 'rgba(0,212,255,0.35)') : 'transparent', flexShrink:0 }} />

      {/* Number */}
      <div style={{ width:'28px', textAlign:'center', color: isSelected ? '#00d4ff' : '#2a4060', fontSize:'10px', fontFamily:'monospace', flexShrink:0 }}>
        {String(num).padStart(2,'0')}
      </div>

      {/* Name */}
      <div style={{ flex:1, overflow:'hidden', paddingInline:'6px' }}>
        {slot ? (
          <span style={{ color: isSelected ? '#e0f8ff' : '#8ab0cc', fontSize:'11px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'block' }}>
            {slot.name}
          </span>
        ) : (
          <span style={{ color:'#1a2d4a', fontSize:'10px', fontStyle:'italic' }}>Empty</span>
        )}
      </div>

      {/* Hover actions */}
      {hovered && (
        <div style={{ display:'flex', gap:'2px', paddingRight:'6px', flexShrink:0 }}>
          <button onClick={e => { e.stopPropagation(); onEdit(); }}
            style={{ background:'rgba(0,212,255,0.12)', border:'none', color:'#00d4ff', fontSize:'9px', padding:'2px 6px', borderRadius:'3px', cursor:'pointer', fontWeight:600 }}>
            {slot ? 'Edit' : '+'}
          </button>
          {slot && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{ background:'rgba(255,77,109,0.12)', border:'none', color:'#ff4d6d', fontSize:'9px', padding:'2px 6px', borderRadius:'3px', cursor:'pointer' }}>
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
