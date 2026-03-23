import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, slotsApi } from '../api';
import SlotModal from '../components/SlotModal';

const TOTAL_CHAR = 8;
const TOTAL_BG   = 8;

export default function Project() {
  const { id } = useParams();
  const [project, setProject]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null); // { type, num, slot }
  const [tab, setTab]                 = useState('layers');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState('');

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

  async function handleSlotSave({ name, description, reference }) {
    const { type, slotNumber } = modal;
    if (type === 'character') await slotsApi.updateCharacter(id, slotNumber, { name, description, reference });
    else await slotsApi.updateBackground(id, slotNumber, { name, description, reference });
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

  function selectSlot(type, num) {
    const slot = getSlot(type, num);
    setSelectedSlot({ type, num, slot });
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-[#4a6080] text-sm">
      Loading…
    </div>
  );

  const totalLayers = (project?.characters?.length || 0) + (project?.backgrounds?.length || 0);
  const STATUS_COLORS = { pending:'#4a6080', processing:'#ffb347', completed:'#00ff94', failed:'#ff4d6d' };

  return (
    <div className="h-screen bg-[#080d1a] flex flex-col overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ══ TOP BAR ══════════════════════════════════════ */}
      <div style={{ background:'#0d1526', borderBottom:'1px solid #1a2d4a', height:'44px' }}
        className="flex items-center px-4 gap-3 shrink-0 z-20">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div style={{ background:'rgba(0,212,255,0.12)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:'6px', width:'26px', height:'26px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px' }}>🎬</div>
          <span style={{ color:'#ffffff', fontWeight:700, fontSize:'13px', letterSpacing:'-0.3px' }}>
            Macrometro <span style={{ color:'#00d4ff' }}>Animation</span>
          </span>
        </Link>

        <div style={{ width:'1px', height:'20px', background:'#1a2d4a' }} />

        {/* Project name */}
        {editingName ? (
          <input autoFocus value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => e.key === 'Enter' && saveName()}
            style={{ background:'transparent', border:'none', borderBottom:'1px solid #00d4ff', color:'#fff', fontWeight:600, fontSize:'13px', outline:'none', width:'180px', paddingBottom:'1px' }}
          />
        ) : (
          <button onClick={() => setEditingName(true)}
            style={{ background:'none', border:'none', color:'#ffffff', fontWeight:600, fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
            {project.name}
            <span style={{ color:'#4a6080', fontSize:'11px' }}>✏️</span>
          </button>
        )}

        {/* Tab switcher */}
        <div style={{ display:'flex', gap:'2px', background:'#111e35', borderRadius:'8px', padding:'3px', border:'1px solid #1a2d4a' }}>
          {[['layers','⬛ Layers'],['videos','▶ Videos']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{
                padding:'3px 12px', borderRadius:'5px', fontSize:'11px', fontWeight:600, cursor:'pointer', border:'none', transition:'all .15s',
                background: tab === k ? '#00d4ff' : 'transparent',
                color:      tab === k ? '#080d1a' : '#4a6080',
              }}>
              {l}
            </button>
          ))}
        </div>

        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ color:'#4a6080', fontSize:'11px', fontFamily:'monospace' }}>
            {totalLayers} layer{totalLayers !== 1 ? 's' : ''}
          </span>
          <Link to={`/project/${id}/upload`}
            style={{ background:'#00d4ff', color:'#080d1a', fontWeight:700, fontSize:'12px', padding:'5px 14px', borderRadius:'8px', textDecoration:'none', boxShadow:'0 0 12px rgba(0,212,255,0.35)' }}>
            + New Video
          </Link>
        </div>
      </div>

      {/* ══ MAIN AREA ════════════════════════════════════ */}
      {tab === 'layers' ? (

        <div className="flex flex-1 overflow-hidden">

          {/* ── LEFT: LAYER PANEL ──────────────────────── */}
          <div style={{ width:'240px', background:'#0d1526', borderRight:'1px solid #1a2d4a', display:'flex', flexDirection:'column', overflow:'hidden', shrink:0 }}>

            {/* Characters group */}
            <LayerGroup
              title="CHARACTERS" icon="👤"
              slots={TOTAL_CHAR} type="character"
              getSlot={getSlot}
              selected={selectedSlot}
              onSelect={selectSlot}
              onEdit={(n,s) => { setModal({ type:'character', slotNumber:n, slot:s }); selectSlot('character', n); }}
              onDelete={handleSlotDelete}
            />

            <div style={{ height:'1px', background:'#1a2d4a' }} />

            {/* Backgrounds group */}
            <LayerGroup
              title="BACKGROUNDS" icon="🌄"
              slots={TOTAL_BG} type="background"
              getSlot={getSlot}
              selected={selectedSlot}
              onSelect={selectSlot}
              onEdit={(n,s) => { setModal({ type:'background', slotNumber:n, slot:s }); selectSlot('background', n); }}
              onDelete={handleSlotDelete}
            />
          </div>

          {/* ── CENTER: CANVAS ─────────────────────────── */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'#080d1a' }}>

            {/* Canvas toolbar */}
            <div style={{ height:'32px', background:'#0d1526', borderBottom:'1px solid #1a2d4a', display:'flex', alignItems:'center', paddingInline:'14px', gap:'10px', shrink:0 }}>
              <span style={{ color:'#4a6080', fontSize:'11px', fontFamily:'monospace' }}>
                {selectedSlot?.slot ? `📌 ${selectedSlot.slot.name}` : 'Canvas'}
              </span>
              {selectedSlot?.slot && (
                <button
                  onClick={() => setModal({ type: selectedSlot.type, slotNumber: selectedSlot.num, slot: selectedSlot.slot })}
                  style={{ marginLeft:'auto', background:'rgba(0,212,255,0.12)', border:'1px solid rgba(0,212,255,0.3)', color:'#00d4ff', fontSize:'11px', padding:'2px 10px', borderRadius:'5px', cursor:'pointer' }}>
                  Edit Layer
                </button>
              )}
            </div>

            {/* Canvas area */}
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>

              {/* Grid background like animation software */}
              <div style={{
                position:'absolute', inset:0,
                backgroundImage:`
                  linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)`,
                backgroundSize:'40px 40px',
              }} />

              {selectedSlot?.slot ? (
                <div style={{ position:'relative', zIndex:1, textAlign:'center', maxWidth:'80%' }}>
                  {selectedSlot.slot.reference_image_url ? (
                    <div>
                      <div style={{
                        border:'2px solid rgba(0,212,255,0.4)', borderRadius:'12px', padding:'12px',
                        background:'rgba(0,212,255,0.05)', boxShadow:'0 0 40px rgba(0,212,255,0.15)',
                        display:'inline-block',
                      }}>
                        <img
                          src={`/api/download?key=${encodeURIComponent(selectedSlot.slot.reference_image_url)}`}
                          alt={selectedSlot.slot.name}
                          style={{ maxHeight:'60vh', maxWidth:'100%', borderRadius:'8px', display:'block' }}
                          onError={e => e.target.style.display='none'}
                        />
                      </div>
                      <p style={{ color:'#00d4ff', fontSize:'13px', fontWeight:600, marginTop:'14px' }}>
                        {selectedSlot.slot.name}
                      </p>
                      {selectedSlot.slot.description && (
                        <p style={{ color:'#4a6080', fontSize:'11px', marginTop:'4px' }}>
                          {selectedSlot.slot.description}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'64px', opacity:.3, marginBottom:'16px' }}>
                        {selectedSlot.type === 'character' ? '👤' : '🌄'}
                      </div>
                      <p style={{ color:'#ffffff', fontSize:'18px', fontWeight:700, marginBottom:'6px' }}>
                        {selectedSlot.slot.name}
                      </p>
                      <p style={{ color:'#4a6080', fontSize:'12px', marginBottom:'20px' }}>
                        {selectedSlot.slot.description || 'No description'}
                      </p>
                      <button
                        onClick={() => setModal({ type: selectedSlot.type, slotNumber: selectedSlot.num, slot: selectedSlot.slot })}
                        style={{ background:'rgba(0,212,255,0.12)', border:'1px solid rgba(0,212,255,0.35)', color:'#00d4ff', padding:'8px 20px', borderRadius:'8px', fontSize:'12px', cursor:'pointer' }}>
                        + Upload Reference Image
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ position:'relative', zIndex:1, textAlign:'center' }}>
                  <div style={{ fontSize:'72px', opacity:.15, marginBottom:'20px' }}>🎬</div>
                  <p style={{ color:'#ffffff', fontSize:'20px', fontWeight:700, marginBottom:'8px' }}>
                    {project.name}
                  </p>
                  <p style={{ color:'#4a6080', fontSize:'13px', marginBottom:'28px' }}>
                    Select a layer on the left to configure it
                  </p>
                  <Link to={`/project/${id}/upload`}
                    style={{ background:'#00d4ff', color:'#080d1a', fontWeight:700, fontSize:'13px', padding:'10px 24px', borderRadius:'10px', textDecoration:'none', boxShadow:'0 0 20px rgba(0,212,255,0.4)' }}>
                    Upload Frames & Start Processing →
                  </Link>
                </div>
              )}
            </div>
          </div>

        </div>

      ) : (

        /* ══ VIDEOS TAB ══════════════════════════════════ */
        <div style={{ flex:1, overflow:'auto', padding:'24px' }}>
          {!project.videos?.length ? (
            <div style={{ textAlign:'center', paddingTop:'80px' }}>
              <div style={{ fontSize:'48px', opacity:.2, marginBottom:'16px' }}>▶</div>
              <p style={{ color:'#4a6080', fontSize:'14px', marginBottom:'12px' }}>No videos yet.</p>
              <Link to={`/project/${id}/upload`}
                style={{ color:'#00d4ff', fontSize:'13px', textDecoration:'none' }}>
                Upload your first video →
              </Link>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #1a2d4a' }}>
                  {['Name','Frames','Status','Date'].map(h => (
                    <th key={h} style={{ padding:'8px 16px 8px 0', textAlign:'left', color:'#4a6080', fontSize:'11px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {project.videos.map(v => (
                  <tr key={v.id} style={{ borderBottom:'1px solid rgba(26,45,74,0.5)' }}>
                    <td style={{ padding:'12px 16px 12px 0' }}>
                      <Link to={`/video/${v.id}`} style={{ color:'#ffffff', fontSize:'13px', fontWeight:500, textDecoration:'none' }}
                        onMouseEnter={e => e.target.style.color='#00d4ff'}
                        onMouseLeave={e => e.target.style.color='#ffffff'}>
                        {v.name}
                      </Link>
                    </td>
                    <td style={{ padding:'12px 16px 12px 0', color:'#4a6080', fontSize:'12px', fontFamily:'monospace' }}>{v.frame_count}</td>
                    <td style={{ padding:'12px 16px 12px 0' }}>
                      <span style={{ color: STATUS_COLORS[v.status] || '#4a6080', fontSize:'12px', fontWeight:500 }}>
                        ● {v.status}
                      </span>
                    </td>
                    <td style={{ padding:'12px 0', color:'#4a6080', fontSize:'12px', fontFamily:'monospace' }}>
                      {new Date(v.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modal && (
        <SlotModal slot={modal.slot} slotType={modal.type}
          onSave={handleSlotSave} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

/* ── Layer Group ──────────────────────────────────── */
function LayerGroup({ title, icon, slots, type, getSlot, selected, onSelect, onEdit, onDelete }) {
  return (
    <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
      {/* Group header */}
      <div style={{ padding:'8px 12px', background:'#080d1a', borderBottom:'1px solid #1a2d4a', display:'flex', alignItems:'center', gap:'6px', position:'sticky', top:0, zIndex:5 }}>
        <span style={{ fontSize:'12px' }}>{icon}</span>
        <span style={{ color:'#00d4ff', fontSize:'10px', fontWeight:700, letterSpacing:'0.12em' }}>{title}</span>
      </div>

      {/* Rows */}
      {Array.from({ length: slots }, (_, i) => i + 1).map(num => {
        const slot = getSlot(type, num);
        const isSelected = selected?.type === type && selected?.num === num;
        return (
          <LayerRow key={num} num={num} slot={slot} isSelected={isSelected}
            onClick={() => onSelect(type, num)}
            onEdit={() => onEdit(num, slot)}
            onDelete={() => onDelete(type, num)}
          />
        );
      })}
    </div>
  );
}

/* ── Layer Row ────────────────────────────────────── */
function LayerRow({ num, slot, isSelected, onClick, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:'flex', alignItems:'center', gap:0, cursor:'pointer',
        borderBottom:'1px solid rgba(26,45,74,0.5)',
        background: isSelected ? 'rgba(0,212,255,0.08)' : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        transition:'background .1s',
      }}>

      {/* Number */}
      <div style={{ width:'32px', textAlign:'center', color: isSelected ? '#00d4ff' : '#2a4060', fontSize:'10px', fontFamily:'monospace', paddingBlock:'10px', shrink:0 }}>
        {String(num).padStart(2,'0')}
      </div>

      {/* Color indicator */}
      <div style={{ width:'3px', alignSelf:'stretch', background: slot ? (isSelected ? '#00d4ff' : 'rgba(0,212,255,0.4)') : 'transparent', shrink:0 }} />

      {/* Content */}
      <div style={{ flex:1, paddingInline:'10px', paddingBlock:'8px', minWidth:0 }}>
        {slot ? (
          <>
            <div style={{ color:'#ffffff', fontSize:'12px', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {slot.name}
            </div>
            {slot.description && (
              <div style={{ color:'#4a6080', fontSize:'10px', marginTop:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {slot.description}
              </div>
            )}
          </>
        ) : (
          <div style={{ color:'rgba(74,96,128,0.4)', fontSize:'11px', fontStyle:'italic' }}>
            Empty
          </div>
        )}
      </div>

      {/* Actions on hover */}
      {hovered && (
        <div style={{ display:'flex', gap:'2px', paddingRight:'8px', shrink:0 }}>
          <button onClick={e => { e.stopPropagation(); onEdit(); }}
            style={{ background:'rgba(0,212,255,0.12)', border:'none', color:'#00d4ff', fontSize:'10px', padding:'3px 7px', borderRadius:'4px', cursor:'pointer' }}>
            {slot ? 'Edit' : '+'}
          </button>
          {slot && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{ background:'rgba(255,77,109,0.12)', border:'none', color:'#ff4d6d', fontSize:'10px', padding:'3px 7px', borderRadius:'4px', cursor:'pointer' }}>
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
