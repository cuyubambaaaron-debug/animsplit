import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '../api';
import Header from '../components/Header';

export default function Home() {
  const [projects, setProjects]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [newName, setNewName]     = useState('');
  const [showForm, setShowForm]   = useState(false);

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    try {
      const { data } = await projectsApi.list();
      setProjects(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
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
    } catch (e) { alert('Error creating project'); }
    finally { setCreating(false); }
  }

  async function handleDelete(id, e) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('Delete this project?')) return;
    try {
      await projectsApi.delete(id);
      setProjects((p) => p.filter((x) => x.id !== id));
    } catch (e) { alert('Error deleting project'); }
  }

  return (
    <div className="min-h-screen bg-navy">
      <Header
        action={
          <button
            onClick={() => setShowForm(true)}
            className="bg-cyan text-navy text-sm font-semibold px-4 py-2 rounded-xl hover:shadow-cyan transition-all"
          >
            + New Project
          </button>
        }
      />

      <main className="max-w-7xl mx-auto px-5 py-10">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-1">
            Projects
          </h1>
          <p className="text-muted text-sm">
            Separate anime elements from video frames — automatically.
          </p>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-panel border border-cyan/30 rounded-2xl p-5 mb-8 shadow-cyan">
            <form onSubmit={handleCreate} className="flex gap-3">
              <input
                autoFocus
                className="flex-1 bg-navy border border-border rounded-xl px-4 py-2.5 text-white placeholder-muted focus:outline-none focus:border-cyan transition-colors"
                placeholder="Project name — e.g. Episode 01"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="bg-cyan text-navy font-semibold px-5 py-2.5 rounded-xl hover:shadow-cyan transition-all disabled:opacity-40"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-muted px-4 py-2.5 rounded-xl border border-border hover:border-muted transition-colors"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="text-center py-24 text-muted text-sm">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4 opacity-40">🎬</div>
            <p className="text-muted">No projects yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 text-cyan text-sm hover:text-cyan-glow transition-colors"
            >
              Create your first project →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/project/${p.id}`}
                className="group bg-panel border border-border hover:border-cyan/50 rounded-2xl p-5 transition-all hover:shadow-cyan relative"
              >
                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(p.id, e)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition-all text-xs"
                >
                  ✕
                </button>

                <div className="w-10 h-10 rounded-xl bg-cyan/10 border border-cyan/20 flex items-center justify-center text-xl mb-4">
                  🎞️
                </div>
                <h3 className="text-white font-semibold truncate group-hover:text-cyan transition-colors">
                  {p.name}
                </h3>
                <p className="text-muted text-xs mt-1">
                  {new Date(p.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
