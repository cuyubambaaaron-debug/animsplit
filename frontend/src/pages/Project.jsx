import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, slotsApi } from '../api';
import Header from '../components/Header';
import SlotModal from '../components/SlotModal';

const TOTAL_SLOTS = 5;

const STATUS = {
  pending:    { label: 'Pending',    cls: 'bg-border text-muted' },
  processing: { label: 'Processing', cls: 'bg-warning/20 text-warning' },
  completed:  { label: 'Done',       cls: 'bg-success/15 text-success' },
  failed:     { label: 'Failed',     cls: 'bg-danger/15 text-danger' },
};

export default function Project() {
  const { id } = useParams();
  const [project, setProject]   = useState(null);
  const [tab, setTab]           = useState('slots');
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);
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
      setProject((p) => ({ ...p, name: nameInput.trim() }));
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
      ?.find((s) => s.slot_number === n) || null;
  }

  if (loading) return (
    <div className="min-h-screen bg-navy flex items-center justify-center text-muted text-sm">Loading…</div>
  );

  return (
    <div className="min-h-screen bg-navy">
      <Header
        back="/"
        backLabel="Projects"
        title={project?.name}
        action={
          <Link
            to={`/project/${id}/upload`}
            className="bg-cyan text-navy text-sm font-semibold px-4 py-2 rounded-xl hover:shadow-cyan transition-all"
          >
            + New Video
          </Link>
        }
      />

      <main className="max-w-7xl mx-auto px-5 py-8">
        {/* Project name */}
        <div className="mb-7">
          {editingName ? (
            <input
              autoFocus
              className="bg-transparent border-b border-cyan text-2xl font-bold text-white focus:outline-none pb-0.5"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
            />
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              className="text-2xl font-bold text-white cursor-pointer hover:text-cyan transition-colors inline-flex items-center gap-2"
            >
              {project.name}
              <span className="text-base text-muted opacity-0 hover:opacity-100">✏️</span>
            </h1>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-panel border border-border rounded-xl p-1 w-fit mb-7">
          {[
            { key: 'slots',  label: 'Layers' },
            { key: 'videos', label: 'Videos' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-cyan text-navy shadow-cyan-sm'
                  : 'text-muted hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* SLOTS */}
        {tab === 'slots' && (
          <div className="space-y-8">
            <SlotSection
              title="Characters" icon="👤"
              subtitle="Foreground elements — characters, objects, props"
              type="character" totalSlots={TOTAL_SLOTS}
              getSlot={getSlot}
              onEdit={(n, s) => setModal({ type: 'character', slotNumber: n, slot: s })}
              onDelete={(n) => handleSlotDelete('character', n)}
            />
            <SlotSection
              title="Backgrounds" icon="🌄"
              subtitle="Background layers — scenes, environments"
              type="background" totalSlots={TOTAL_SLOTS}
              getSlot={getSlot}
              onEdit={(n, s) => setModal({ type: 'background', slotNumber: n, slot: s })}
              onDelete={(n) => handleSlotDelete('background', n)}
            />
          </div>
        )}

        {/* VIDEOS */}
        {tab === 'videos' && (
          <div>
            {!project.videos?.length ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-3 opacity-30">📭</div>
                <p className="text-muted text-sm">No videos yet.</p>
                <Link to={`/project/${id}/upload`} className="mt-3 inline-block text-cyan text-sm hover:text-cyan-glow">
                  Upload your first video →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {project.videos.map((v) => {
                  const st = STATUS[v.status] || STATUS.pending;
                  return (
                    <Link
                      key={v.id}
                      to={`/video/${v.id}`}
                      className="flex items-center justify-between bg-panel border border-border hover:border-cyan/40 rounded-xl px-5 py-4 transition-all group"
                    >
                      <div>
                        <p className="text-white font-medium text-sm group-hover:text-cyan transition-colors">{v.name}</p>
                        <p className="text-muted text-xs mt-0.5 font-mono">
                          {v.frame_count} frames · {new Date(v.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

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

function SlotSection({ title, icon, subtitle, type, totalSlots, getSlot, onEdit, onDelete }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{icon}</span>
        <div>
          <h3 className="text-white font-semibold text-sm">{title}</h3>
          <p className="text-muted text-xs">{subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: totalSlots }, (_, i) => i + 1).map((num) => {
          const slot = getSlot(type, num);
          return (
            <div
              key={num}
              className={`border rounded-xl p-4 transition-all min-h-[100px] flex flex-col justify-between ${
                slot
                  ? 'bg-panel border-cyan/30 hover:border-cyan'
                  : 'bg-panel/40 border-border border-dashed hover:bg-panel'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-muted">L{num}</span>
                {slot && (
                  <button
                    onClick={() => onDelete(num)}
                    className="text-muted hover:text-danger text-xs transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>

              {slot ? (
                <div className="flex-1">
                  <p className="text-white text-sm font-medium truncate">{slot.name}</p>
                  {slot.description && (
                    <p className="text-muted text-xs mt-1 line-clamp-2 leading-relaxed">{slot.description}</p>
                  )}
                  <button
                    onClick={() => onEdit(num, slot)}
                    className="mt-3 text-xs text-cyan hover:text-cyan-glow transition-colors"
                  >
                    Edit →
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onEdit(num, null)}
                  className="flex-1 text-muted hover:text-cyan text-sm transition-colors text-center pt-2"
                >
                  + Add Layer
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
