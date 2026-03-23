import { useState } from 'react';

export default function SlotModal({ slot, slotType, onSave, onClose }) {
  const [name, setName]               = useState(slot?.name || '');
  const [description, setDescription] = useState(slot?.description || '');
  const [reference, setReference]     = useState(null);
  const [saving, setSaving]           = useState(false);

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
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-panel border border-border rounded-2xl w-full max-w-md p-6 shadow-cyan">
        <div className="flex items-center gap-3 mb-5">
          <div className="text-2xl">{slotType === 'character' ? '👤' : '🌄'}</div>
          <div>
            <h2 className="text-white font-semibold">Configure Layer</h2>
            <p className="text-muted text-xs capitalize">{slotType} slot</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">
              Layer Name *
            </label>
            <input
              autoFocus
              className="w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-white placeholder-muted focus:outline-none focus:border-cyan transition-colors"
              placeholder={slotType === 'character' ? 'e.g. Main Character' : 'e.g. City Background'}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">
              Description for AI
            </label>
            <textarea
              className="w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-white placeholder-muted focus:outline-none focus:border-cyan transition-colors resize-none text-sm"
              placeholder={slotType === 'character'
                ? 'e.g. anime girl, pink hair, blue jacket, facing left'
                : 'e.g. futuristic city, night, neon lights, no characters'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">
              Reference Image (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              className="w-full text-sm text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-border file:bg-card file:text-cyan file:text-xs file:cursor-pointer cursor-pointer"
              onChange={(e) => setReference(e.target.files[0] || null)}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-muted hover:text-white hover:border-muted transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-cyan text-navy font-semibold text-sm transition-all hover:shadow-cyan disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Layer'}
          </button>
        </div>
      </div>
    </div>
  );
}
