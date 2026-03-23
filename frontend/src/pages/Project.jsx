import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, slotsApi } from '../api';
import Header from '../components/Header';
import SlotModal from '../components/SlotModal';

const TOTAL_SLOTS = 5;

const STATUS_BADGE = {
  pending:    'bg-slate-700 text-slate-300',
  processing: 'bg-warning/20 text-warning',
  completed:  'bg-success/20 text-success',
  failed:     'bg-danger/20 text-danger',
};

export default function Project() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('slots');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { type: 'character'|'background', slotNumber, slot }
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    loadProject();
  }, [id]);

  async function loadProject() {
    try {
      const { data } = await projectsApi.get(id);
      setProject(data);
      setNameInput(data.name);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    if (!nameInput.trim() || nameInput === project.name) {
      setEditingName(false);
      return;
    }
    try {
      await projectsApi.update(id, nameInput.trim());
      setProject((p) => ({ ...p, name: nameInput.trim() }));
    } catch (e) {
      alert('Error updating name');
    }
    setEditingName(false);
  }

  async function handleSlotSave({ name, description, reference }) {
    const { type, slotNumber } = modal;
    if (type === 'character') {
      await slotsApi.updateCharacter(id, slotNumber, { name, description, reference });
    } else {
      await slotsApi.updateBackground(id, slotNumber, { name, description, reference });
    }
    await loadProject();
  }

  async function handleSlotDelete(type, slotNumber) {
    if (!confirm('Clear this slot?')) return;
    if (type === 'character') {
      await slotsApi.deleteCharacter(id, slotNumber);
    } else {
      await slotsApi.deleteBackground(id, slotNumber);
    }
    await loadProject();
  }

  function getSlot(type, slotNumber) {
    if (!project) return null;
    const arr = type === 'character' ? project.characters : project.backgrounds;
    return arr?.find((s) => s.slot_number === slotNumber) || null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">Project not found.</p>
          <Link to="/" className="text-accent mt-2 inline-block">← Go home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        back="/"
        backLabel="Projects"
        title={project.name}
        action={
          <Link
            to={`/project/${id}/upload`}
            className="bg-accent hover:bg-accent-light text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            + New Video
          </Link>
        }
      />

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Project name */}
        <div className="mb-6 flex items-center gap-3">
          {editingName ? (
            <>
              <input
                autoFocus
                className="bg-surface border border-accent rounded-lg px-3 py-1.5 text-white text-xl font-bold focus:outline-none"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
              />
            </>
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              className="text-2xl font-bold text-white cursor-pointer hover:text-accent-light transition-colors"
              title="Click to rename"
            >
              {project.name} ✏️
            </h1>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-card rounded-lg p-1 w-fit border border-border">
          {['slots', 'videos'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? 'bg-accent text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t === 'slots' ? '🎭 Slots' : '🎬 Videos'}
            </button>
          ))}
        </div>

        {/* ── SLOTS TAB ─────────────────────────────────────────── */}
        {tab === 'slots' && (
          <div className="space-y-8">
            <SlotSection
              title="👤 Character Slots"
              subtitle="Define the characters to extract from your frames"
              type="character"
              totalSlots={TOTAL_SLOTS}
              getSlot={getSlot}
              onEdit={(slotNumber, slot) => setModal({ type: 'character', slotNumber, slot })}
              onDelete={(slotNumber) => handleSlotDelete('character', slotNumber)}
            />
            <SlotSection
              title="🌄 Background Slots"
              subtitle="Define the backgrounds to extract from your frames"
              type="background"
              totalSlots={TOTAL_SLOTS}
              getSlot={getSlot}
              onEdit={(slotNumber, slot) => setModal({ type: 'background', slotNumber, slot })}
              onDelete={(slotNumber) => handleSlotDelete('background', slotNumber)}
            />
          </div>
        )}

        {/* ── VIDEOS TAB ────────────────────────────────────────── */}
        {tab === 'videos' && (
          <div>
            {project.videos?.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-slate-400">No videos yet.</p>
                <Link
                  to={`/project/${id}/upload`}
                  className="mt-3 inline-block text-accent hover:text-accent-light text-sm"
                >
                  Upload your first video →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {project.videos.map((v) => (
                  <Link
                    key={v.id}
                    to={`/video/${v.id}`}
                    className="flex items-center justify-between bg-card border border-border hover:border-accent/50 rounded-xl px-5 py-4 transition-all group"
                  >
                    <div>
                      <p className="text-white font-medium group-hover:text-accent-light transition-colors">
                        {v.name}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {v.frame_count} frames · {new Date(v.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_BADGE[v.status] || STATUS_BADGE.pending}`}>
                      {v.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Slot modal */}
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

function SlotSection({ title, subtitle, type, totalSlots, getSlot, onEdit, onDelete }) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-white font-semibold">{title}</h3>
        <p className="text-slate-500 text-sm">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: totalSlots }, (_, i) => i + 1).map((num) => {
          const slot = getSlot(type, num);
          return (
            <div
              key={num}
              className={`border rounded-xl p-4 transition-all ${
                slot
                  ? 'bg-card border-accent/40 hover:border-accent'
                  : 'bg-card/40 border-border border-dashed hover:border-border hover:bg-card'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-slate-500 font-mono">
                  Slot {num}
                </span>
                {slot && (
                  <button
                    onClick={() => onDelete(num)}
                    className="text-xs text-slate-600 hover:text-danger transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {slot ? (
                <div>
                  <p className="text-white font-medium text-sm">{slot.name}</p>
                  {slot.description && (
                    <p className="text-slate-400 text-xs mt-1 line-clamp-2">{slot.description}</p>
                  )}
                  <button
                    onClick={() => onEdit(num, slot)}
                    className="mt-3 text-xs text-accent hover:text-accent-light transition-colors"
                  >
                    Edit →
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onEdit(num, null)}
                  className="w-full text-center text-slate-500 hover:text-accent text-sm transition-colors py-2"
                >
                  + Configure
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
