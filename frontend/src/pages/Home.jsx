import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '../api';
import Header from '../components/Header';

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const { data } = await projectsApi.list();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await projectsApi.create(newName.trim());
      setProjects((p) => [data, ...p]);
      setNewName('');
      setShowForm(false);
    } catch (e) {
      alert('Error creating project');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      await projectsApi.delete(id);
      setProjects((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      alert('Error deleting project');
    }
  }

  return (
    <div className="min-h-screen">
      <Header
        action={
          <button
            onClick={() => setShowForm(true)}
            className="bg-accent hover:bg-accent-light text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            + New Project
          </button>
        }
      />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Projects</h2>
          <p className="text-slate-400 text-sm mt-1">
            Separate anime characters and backgrounds from video frames
          </p>
        </div>

        {/* New project form */}
        {showForm && (
          <div className="bg-card border border-accent/40 rounded-xl p-5 mb-6">
            <form onSubmit={handleCreate} className="flex gap-3">
              <input
                autoFocus
                className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                placeholder="Project name (e.g. Episode 12)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="bg-accent hover:bg-accent-light text-white px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-white px-3 py-2 rounded-lg border border-border transition-colors"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Projects grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎬</div>
            <p className="text-slate-400">No projects yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/project/${p.id}`}
                className="bg-card border border-border hover:border-accent/60 rounded-xl p-5 group transition-all hover:shadow-lg hover:shadow-accent/10 relative"
              >
                <div className="flex items-start justify-between">
                  <div className="text-3xl mb-3">🎞️</div>
                  <button
                    onClick={(e) => handleDelete(p.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-danger transition-all text-xs px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </div>
                <h3 className="text-white font-semibold truncate">{p.name}</h3>
                <p className="text-slate-500 text-xs mt-1">
                  {new Date(p.created_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
