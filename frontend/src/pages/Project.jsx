import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, slotsApi } from '../api';
import Header from '../components/Header';
import SlotModal from '../components/SlotModal';

const TOTAL_SLOTS = 8;

const STATUS = {
  pending:    { label: 'Pending',    cls: 'text-muted bg-border/50' },
  processing: { label: 'Processing', cls: 'text-warning bg-warning/10' },
  completed:  { label: 'Done',       cls: 'text-success bg-success/10' },
  failed:     { label: 'Failed',     cls: 'text-danger bg-danger/10' },
};

export default function Project() {
  const { id } = useParams();
  const [project, setProject]         = useState(null);
  const [tab, setTab]                 = useState('layers');
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState(null);
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
  }

  async function handleSlotDelete(type, slotNumber) {
    if (!confirm('Clear this layer?')) return;
    if (type === 'character') await slotsApi.deleteCharacter(id, slotNumber);
    else await slotsApi.deleteBackground(id, slotNumber);
    await loadProject();
  }

  function getSlot(type, n) {
    if (!project) return null;
    return (type === 'character' ? project.characters : project.backgrounds)
      ?.find(s => s.slot_number === n) || null;
  }

  if (loading) return (
    <div className="min-h-screen bg-navy flex items-center justify-center text-muted text-sm">Loading…</div>
  );

  const totalLayers = (project?.characters?.length || 0) + (project?.backgrounds?.length || 0);

  return (
    <div className="min-h-screen bg-navy flex flex-col">
      <Header
        back="/"
        backLabel="Projects"
        title={project?.name}
        action={
          <Link to={`/project/${id}/upload`}
            className="bg-cyan text-navy text-sm font-semibold px-4 py-1.5 rounded-lg hover:shadow-cyan transition-all">
            + New Video
          </Link>
        }
      />

      {/* ── TOOLBAR ───────────────────────────────────── */}
      <div className="bg-panel border-b border-border px-5 py-2 flex items-center gap-4">
        {/* Project name */}
        {editingName ? (
          <input autoFocus
            className="bg-transparent border-b border-cyan text-white font-semibold text-sm focus:outline-none pb-0.5 w-48"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => e.key === 'Enter' && saveName()}
          />
        ) : (
          <button onClick={() => setEditingName(true)}
            className="text-white font-semibold text-sm hover:text-cyan transition-colors flex items-center gap-1.5">
            {project.name}
            <span className="text-muted text-xs">✏️</span>
          </button>
        )}

        <div className="h-4 w-px bg-border" />

        {/* Tabs */}
        <div className="flex gap-1">
          {[
            { key: 'layers', label: '⬛ Layers' },
            { key: 'videos', label: '▶ Videos' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                tab === key
                  ? 'bg-cyan/15 text-cyan border border-cyan/30'
                  : 'text-muted hover:text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto text-xs text-muted font-mono">
          {totalLayers} layer{totalLayers !== 1 ? 's' : ''} configured
        </div>
      </div>

      {/* ── CONTENT ───────────────────────────────────── */}
      <div className="flex-1 overflow-auto">

        {/* LAYERS TAB */}
        {tab === 'layers' && (
          <div className="flex flex-col">

            {/* CHARACTER LAYERS */}
            <LayerGroup
              title="CHARACTERS"
              icon="👤"
              color="text-cyan"
              totalSlots={TOTAL_SLOTS}
              type="character"
              getSlot={getSlot}
              onEdit={(n, s) => setModal({ type: 'character', slotNumber: n, slot: s })}
              onDelete={n => handleSlotDelete('character', n)}
            />

            {/* DIVIDER */}
            <div className="h-px bg-border mx-0" />

            {/* BACKGROUND LAYERS */}
            <LayerGroup
              title="BACKGROUNDS"
              icon="🌄"
              color="text-cyan-glow"
              totalSlots={TOTAL_SLOTS}
              type="background"
              getSlot={getSlot}
              onEdit={(n, s) => setModal({ type: 'background', slotNumber: n, slot: s })}
              onDelete={n => handleSlotDelete('background', n)}
            />
          </div>
        )}

        {/* VIDEOS TAB */}
        {tab === 'videos' && (
          <div className="p-5">
            {!project.videos?.length ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-3 opacity-20">▶</div>
                <p className="text-muted text-sm">No videos yet.</p>
                <Link to={`/project/${id}/upload`}
                  className="mt-3 inline-block text-cyan text-sm hover:text-cyan-glow transition-colors">
                  Upload your first video →
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 text-xs text-muted font-medium uppercase tracking-wider pr-4">Name</th>
                    <th className="pb-2 text-xs text-muted font-medium uppercase tracking-wider pr-4">Frames</th>
                    <th className="pb-2 text-xs text-muted font-medium uppercase tracking-wider pr-4">Status</th>
                    <th className="pb-2 text-xs text-muted font-medium uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {project.videos.map(v => {
                    const st = STATUS[v.status] || STATUS.pending;
                    return (
                      <tr key={v.id}
                        className="border-b border-border/50 hover:bg-panel/50 cursor-pointer transition-colors group">
                        <td className="py-3 pr-4">
                          <Link to={`/video/${v.id}`}
                            className="text-white text-sm font-medium group-hover:text-cyan transition-colors">
                            {v.name}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-muted">{v.frame_count}</td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="py-3 text-xs text-muted font-mono">
                          {new Date(v.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {modal && (
        <SlotModal
          slot={modal.slot}
          slotType={modal.type}
          onSave={handleSlotSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

/* ── Layer Group ──────────────────────────────────── */
function LayerGroup({ title, icon, color, totalSlots, type, getSlot, onEdit, onDelete }) {
  return (
    <div>
      {/* Group header */}
      <div className="flex items-center gap-2 px-5 py-2 bg-navy/60 border-b border-border sticky top-0 z-10">
        <span className="text-sm">{icon}</span>
        <span className={`text-xs font-bold tracking-widest uppercase ${color}`}>{title}</span>
      </div>

      {/* Layer rows */}
      <div>
        {Array.from({ length: totalSlots }, (_, i) => i + 1).map(num => {
          const slot = getSlot(type, num);
          return (
            <LayerRow
              key={num}
              num={num}
              slot={slot}
              onEdit={() => onEdit(num, slot)}
              onDelete={() => onDelete(num)}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── Single Layer Row ─────────────────────────────── */
function LayerRow({ num, slot, onEdit, onDelete }) {
  return (
    <div
      className={`flex items-center border-b border-border/40 group transition-colors cursor-pointer ${
        slot ? 'hover:bg-cyan/5' : 'hover:bg-panel/60'
      }`}
      onClick={onEdit}
    >
      {/* Layer number */}
      <div className="w-12 shrink-0 flex items-center justify-center py-3 border-r border-border/40">
        <span className="text-xs font-mono text-muted">{String(num).padStart(2, '0')}</span>
      </div>

      {/* Color strip */}
      <div className={`w-1 self-stretch shrink-0 ${slot ? 'bg-cyan/60' : 'bg-transparent'}`} />

      {/* Layer info */}
      <div className="flex-1 px-4 py-2.5 min-w-0">
        {slot ? (
          <div className="flex items-center gap-4">
            <span className="text-white text-sm font-medium truncate min-w-0">{slot.name}</span>
            {slot.description && (
              <span className="text-muted text-xs truncate hidden sm:block">{slot.description}</span>
            )}
            {slot.reference_image_url && (
              <span className="text-cyan text-xs shrink-0 font-mono">REF ✓</span>
            )}
          </div>
        ) : (
          <span className="text-muted/40 text-xs italic">Empty — click to configure</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={e => { e.stopPropagation(); onEdit(); }}
          className="text-muted hover:text-cyan text-xs px-2 py-1 rounded hover:bg-cyan/10 transition-all"
        >
          Edit
        </button>
        {slot && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="text-muted hover:text-danger text-xs px-2 py-1 rounded hover:bg-danger/10 transition-all"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
