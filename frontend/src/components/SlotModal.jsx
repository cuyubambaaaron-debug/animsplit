import { useState } from 'react';

export default function SlotModal({ slot, slotType, onSave, onClose }) {
  const [name, setName] = useState(slot?.name || '');
  const [description, setDescription] = useState(slot?.description || '');
  const [reference, setReference] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), reference });
      onClose();
    } catch (e) {
      alert('Error saving slot: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6">
        <h2 className="text-white font-semibold text-lg mb-4">
          Configure {slotType === 'character' ? '👤 Character' : '🌄 Background'} Slot
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Name *</label>
            <input
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-accent"
              placeholder={slotType === 'character' ? 'e.g. Main Character' : 'e.g. City Background'}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Description (for AI)</label>
            <textarea
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-accent resize-none"
              placeholder={slotType === 'character' ? 'e.g. anime girl with pink hair and blue outfit' : 'e.g. futuristic city at night with neon lights'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Reference Image (optional)</label>
            <input
              type="file"
              accept="image/*"
              className="w-full text-sm text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-accent-dim file:text-white file:cursor-pointer cursor-pointer"
              onChange={(e) => setReference(e.target.files[0] || null)}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border text-slate-300 hover:bg-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 py-2 rounded-lg bg-accent hover:bg-accent-light text-white font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Slot'}
          </button>
        </div>
      </div>
    </div>
  );
}
