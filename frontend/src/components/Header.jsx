import { Link } from 'react-router-dom';

export default function Header({ back, backLabel = 'Back', title, action }) {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
        {back ? (
          <Link
            to={back}
            className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            ← {backLabel}
          </Link>
        ) : (
          <Link to="/" className="flex items-center gap-2 font-bold text-accent-light text-lg">
            🎬 AnimSplit
          </Link>
        )}

        {title && (
          <h1 className="text-white font-semibold truncate flex-1">{title}</h1>
        )}

        {action && <div className="ml-auto">{action}</div>}
      </div>
    </header>
  );
}
