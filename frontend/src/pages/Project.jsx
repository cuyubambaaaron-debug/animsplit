import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, slotsApi } from '../api';
import SlotModal from '../components/SlotModal';

const MAX_PER_TYPE = 5;

const S = {
  // Layout
  app:        { height:'100vh', display:'flex', flexDirection:'column', background:'#f0f2f5', fontFamily:'Inter,system-ui,sans-serif', overflow:'hidden', color:'#1a2535' },
  topbar:     { height:'48px', background:'#ffffff', borderBottom:'1px solid #dde1e7', display:'flex', alignItems:'center', paddingInline:'16px', gap:'12px', flexShrink:0, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' },
  middle:     { flex:1, display:'flex', overflow:'hidden', minHeight:0 },
  // Left panel
  leftPanel:  { width:'220px', flexShrink:0, background:'#ffffff', borderRight:'1px solid #dde1e7', display:'flex', flexDirection:'column', overflow:'hidden' },
  groupHead:  { padding:'10px 14px 6px', display:'flex', alignItems:'center', justifyContent:'space-between' },
  groupTitle: { fontSize:'11px', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#6b7c93' },
  addBtn:     { background:'none', border:'1px solid #c8d0db', borderRadius:'5px', color:'#6b7c93', fontSize:'11px', padding:'2px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:'3px' },
  layerRow:   { display:'flex', alignItems:'center', padding:'7px 14px', cursor:'pointer', borderBottom:'1px solid #f0f2f5', gap:'8px', transition:'background .1s' },
  layerName:  { flex:1, fontSize:'12px', fontWeight:500, color:'#1a2535', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  // Canvas
  canvasWrap: { flex:1, background:'#ffffff', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' },
  canvasBg:   { position:'absolute', inset:0, backgroundImage:`linear-gradient(45deg,#f0f2f5 25%,transparent 25%),linear-gradient(-45deg,#f0f2f5 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f0f2f5 75%),linear-gradient(-45deg,transparent 75%,#f0f2f5 75%)`, backgroundSize:'20px 20px', backgroundPosition:'0 0,0 10px,10px -10px,-10px 0' },
  // Timeline
  timeline:   { height:'170px', background:'#ffffff', borderTop:'2px solid #dde1e7', display:'flex', flexDirection:'column', flexShrink:0 },
  tlHead:     { height:'30px', background:'#f7f8fa', borderBottom:'1px solid #dde1e7', display:'flex', alignItems:'center', flexShrink:0 },
  tlColHead:  { width:'220px', flexShrink:0, paddingInline:'14px', borderRight:'1px solid #dde1e7', fontSize:'10px', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#9aa5b4' },
  tlFrameHead:{ flex:1, paddingInline:'10px', fontSize:'10px', color:'#9aa5b4', fontFamily:'monospace', letterSpacing:'0.05em', fontWeight:700 },
  tlRow:      { height:'28px', display:'flex', alignItems:'center', borderBottom:'1px solid #f0f2f5', flexShrink:0 },
  tlName:     { width:'220px', flexShrink:0, paddingInline:'14px', borderRight:'1px solid #dde1e7', display:'flex', alignItems:'center', gap:'6px', overflow:'hidden' },
  tlTrack:    { flex:1, paddingInline:'10px', display:'flex', alignItems:'center', gap:'2px', overflow:'hidden' },
};

export default function Project() {
  const { id } = useParams();
  const [project, setProject]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editingName, setEditingName]   = useState(false);
  const [nameInput, setNameInput]       = useState('');

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
    setProject(p=>({...p,name:nameInput.trim()}));
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
    if (selectedSlot?.type===type && selectedSlot?.num===num) setSelectedSlot(null);
    await load();
  }

  function getSlot(type, n) {
    return (type==='character' ? project?.characters : project?.backgrounds)?.find(s=>s.slot_number===n)||null;
  }

  // How many slots are currently configured per type
  function usedSlots(type) {
    const arr = type==='character' ? project?.characters : project?.backgrounds;
    return arr?.length || 0;
  }

  // Next available slot number
  function nextSlot(type) {
    const used = (type==='character' ? project?.characters : project?.backgrounds)||[];
    for (let i=1;i<=MAX_PER_TYPE;i++) if (!used.find(s=>s.slot_number===i)) return i;
    return null;
  }

  if (loading) return (
    <div style={{height:'100vh',background:'#f0f2f5',display:'flex',alignItems:'center',justifyContent:'center',color:'#9aa5b4',fontFamily:'Inter,sans-serif'}}>Loading…</div>
  );

  const chars = Array.from({length:MAX_PER_TYPE},(_,i)=>i+1).filter(n=>getSlot('character',n));
  const bgs   = Array.from({length:MAX_PER_TYPE},(_,i)=>i+1).filter(n=>getSlot('background',n));
  const allConfigured = [...chars.map(n=>({type:'character',n})), ...bgs.map(n=>({type:'background',n}))];

  return (
    <div style={S.app}>

      {/* ── TOP BAR ─────────────────────────────────── */}
      <div style={S.topbar}>
        <Link to="/" style={{textDecoration:'none',display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{fontSize:'20px'}}>🎬</span>
          <span style={{fontWeight:800,fontSize:'14px',color:'#1a2535'}}>
            Macrometro <span style={{color:'#00b4d8'}}>Animation</span>
          </span>
        </Link>

        <span style={{width:'1px',height:'20px',background:'#dde1e7'}}/>

        {editingName
          ? <input autoFocus value={nameInput}
              onChange={e=>setNameInput(e.target.value)}
              onBlur={saveName} onKeyDown={e=>e.key==='Enter'&&saveName()}
              style={{border:'none',borderBottom:'2px solid #00b4d8',outline:'none',fontWeight:600,fontSize:'14px',color:'#1a2535',background:'transparent',width:'180px'}}/>
          : <button onClick={()=>setEditingName(true)}
              style={{background:'none',border:'none',fontWeight:600,fontSize:'14px',color:'#1a2535',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
              {project.name}
              <span style={{fontSize:'12px',color:'#9aa5b4'}}>✏</span>
            </button>
        }

        <div style={{marginLeft:'auto',display:'flex',gap:'8px',alignItems:'center'}}>
          <Link to={`/project/${id}/upload`}
            style={{background:'#00b4d8',color:'#fff',fontWeight:700,fontSize:'13px',padding:'7px 18px',borderRadius:'8px',textDecoration:'none',boxShadow:'0 2px 8px rgba(0,180,216,0.35)'}}>
            + New Video
          </Link>
        </div>
      </div>

      {/* ── MIDDLE: PANEL + CANVAS ──────────────────── */}
      <div style={S.middle}>

        {/* LEFT PANEL */}
        <div style={S.leftPanel}>

          {/* CHARACTERS */}
          <div style={{borderBottom:'1px solid #dde1e7'}}>
            <div style={S.groupHead}>
              <span style={S.groupTitle}>👤 Characters</span>
              {usedSlots('character') < MAX_PER_TYPE && (
                <button style={S.addBtn}
                  onClick={()=>{ const n=nextSlot('character'); if(n) setModal({type:'character',slotNumber:n,slot:null}); }}>
                  + Add
                </button>
              )}
            </div>

            {chars.length===0
              ? <div style={{padding:'8px 14px 12px',color:'#c0c8d4',fontSize:'11px',fontStyle:'italic'}}>
                  No characters yet
                  <br/>
                  <button style={{...S.addBtn,marginTop:'6px'}}
                    onClick={()=>setModal({type:'character',slotNumber:1,slot:null})}>
                    + Add first character
                  </button>
                </div>
              : chars.map(n=>{
                  const slot=getSlot('character',n);
                  const isSel=selectedSlot?.type==='character'&&selectedSlot?.num===n;
                  return (
                    <LayerItem key={n} slot={slot} isSelected={isSel}
                      icon="👤"
                      onClick={()=>setSelectedSlot({type:'character',num:n,slot})}
                      onEdit={()=>setModal({type:'character',slotNumber:n,slot})}
                      onDelete={()=>handleDelete('character',n)}/>
                  );
                })
            }
          </div>

          {/* BACKGROUNDS */}
          <div style={{flex:1,overflow:'auto'}}>
            <div style={S.groupHead}>
              <span style={S.groupTitle}>🌄 Backgrounds</span>
              {usedSlots('background') < MAX_PER_TYPE && (
                <button style={S.addBtn}
                  onClick={()=>{ const n=nextSlot('background'); if(n) setModal({type:'background',slotNumber:n,slot:null}); }}>
                  + Add
                </button>
              )}
            </div>

            {bgs.length===0
              ? <div style={{padding:'8px 14px 12px',color:'#c0c8d4',fontSize:'11px',fontStyle:'italic'}}>
                  No backgrounds yet
                  <br/>
                  <button style={{...S.addBtn,marginTop:'6px'}}
                    onClick={()=>setModal({type:'background',slotNumber:1,slot:null})}>
                    + Add first background
                  </button>
                </div>
              : bgs.map(n=>{
                  const slot=getSlot('background',n);
                  const isSel=selectedSlot?.type==='background'&&selectedSlot?.num===n;
                  return (
                    <LayerItem key={n} slot={slot} isSelected={isSel}
                      icon="🌄"
                      onClick={()=>setSelectedSlot({type:'background',num:n,slot})}
                      onEdit={()=>setModal({type:'background',slotNumber:n,slot})}
                      onDelete={()=>handleDelete('background',n)}/>
                  );
                })
            }
          </div>
        </div>

        {/* CANVAS */}
        <div style={S.canvasWrap}>
          <div style={S.canvasBg}/>

          <div style={{position:'relative',zIndex:1,textAlign:'center',padding:'24px',maxWidth:'80%'}}>
            {selectedSlot?.slot?.reference_image_url ? (
              <div>
                <img
                  src={`${import.meta.env.VITE_API_URL||''}/api/download?key=${encodeURIComponent(selectedSlot.slot.reference_image_url)}`}
                  alt={selectedSlot.slot.name}
                  style={{maxHeight:'55vh',maxWidth:'100%',boxShadow:'0 8px 40px rgba(0,0,0,0.15)',borderRadius:'6px',display:'block',margin:'0 auto'}}
                />
                <p style={{color:'#1a2535',fontWeight:700,fontSize:'15px',marginTop:'14px'}}>{selectedSlot.slot.name}</p>
                <p style={{color:'#6b7c93',fontSize:'12px',marginTop:'3px'}}>{selectedSlot.slot.description}</p>
              </div>
            ) : selectedSlot?.slot ? (
              <div>
                <div style={{fontSize:'60px',marginBottom:'14px',opacity:0.2}}>{selectedSlot.type==='character'?'👤':'🌄'}</div>
                <p style={{color:'#1a2535',fontSize:'18px',fontWeight:700,marginBottom:'6px'}}>{selectedSlot.slot.name}</p>
                <p style={{color:'#9aa5b4',fontSize:'12px',marginBottom:'20px'}}>{selectedSlot.slot.description||'No description'}</p>
                <button onClick={()=>setModal({type:selectedSlot.type,slotNumber:selectedSlot.num,slot:selectedSlot.slot})}
                  style={{background:'#00b4d8',color:'#fff',fontWeight:700,fontSize:'12px',padding:'8px 20px',borderRadius:'8px',border:'none',cursor:'pointer'}}>
                  + Upload Reference Image
                </button>
              </div>
            ) : (
              <div>
                <div style={{fontSize:'64px',marginBottom:'16px',opacity:0.12}}>🎬</div>
                <p style={{color:'#1a2535',fontSize:'22px',fontWeight:800,marginBottom:'8px'}}>{project.name}</p>
                <p style={{color:'#9aa5b4',fontSize:'13px',marginBottom:'26px'}}>
                  Add characters & backgrounds on the left,<br/>then upload your frames.
                </p>
                <Link to={`/project/${id}/upload`}
                  style={{background:'#00b4d8',color:'#fff',fontWeight:700,fontSize:'14px',padding:'12px 28px',borderRadius:'10px',textDecoration:'none',boxShadow:'0 4px 14px rgba(0,180,216,0.4)',display:'inline-block'}}>
                  Upload Frames & Process →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TIMELINE (ALWAYS AT BOTTOM) ─────────────── */}
      <div style={S.timeline}>
        <div style={S.tlHead}>
          <div style={S.tlColHead}>Layers</div>
          <div style={S.tlFrameHead}>Timeline</div>
          <Link to={`/project/${id}/upload`}
            style={{marginRight:'12px',background:'#00b4d8',color:'#fff',fontSize:'11px',fontWeight:700,padding:'4px 12px',borderRadius:'6px',textDecoration:'none',flexShrink:0}}>
            ▶ Upload
          </Link>
        </div>

        <div style={{flex:1,overflow:'auto'}}>
          {allConfigured.length===0 ? (
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}>
              <span style={{color:'#c0c8d4',fontSize:'12px'}}>Add layers to see the timeline</span>
            </div>
          ) : (
            allConfigured.map(({type,n})=>{
              const slot=getSlot(type,n);
              return (
                <div key={`${type}-${n}`} style={S.tlRow}>
                  <div style={S.tlName}>
                    <span style={{fontSize:'12px'}}>{type==='character'?'👤':'🌄'}</span>
                    <span style={{color:'#1a2535',fontSize:'12px',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{slot?.name}</span>
                  </div>
                  <div style={S.tlTrack}>
                    {Array.from({length:60},(_,i)=>(
                      <div key={i} style={{width:'18px',height:'16px',borderRadius:'3px',background:'#edf0f4',border:'1px solid #dde1e7',flexShrink:0}}/>
                    ))}
                    <span style={{color:'#c0c8d4',fontSize:'10px',marginLeft:'4px',flexShrink:0}}>…</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {modal&&<SlotModal slot={modal.slot} slotType={modal.type} onSave={handleSave} onClose={()=>setModal(null)}/>}
    </div>
  );
}

function LayerItem({ slot, isSelected, icon, onClick, onEdit, onDelete }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        display:'flex',alignItems:'center',gap:'8px',padding:'8px 14px',cursor:'pointer',
        borderBottom:'1px solid #f0f2f5',borderLeft:`3px solid ${isSelected?'#00b4d8':'transparent'}`,
        background: isSelected?'#f0fbff': hov?'#f7f9fc':'transparent',
        transition:'all .1s',
      }}>
      <span style={{fontSize:'14px'}}>{icon}</span>
      <span style={{flex:1,fontSize:'12px',fontWeight:500,color:'#1a2535',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
        {slot?.name}
      </span>
      {hov&&(
        <div style={{display:'flex',gap:'3px',flexShrink:0}}>
          <button onClick={e=>{e.stopPropagation();onEdit();}}
            style={{background:'#e8f8fc',border:'none',color:'#00b4d8',fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'4px',cursor:'pointer'}}>
            Edit
          </button>
          <button onClick={e=>{e.stopPropagation();onDelete();}}
            style={{background:'#fef2f2',border:'none',color:'#ef4444',fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'4px',cursor:'pointer'}}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
