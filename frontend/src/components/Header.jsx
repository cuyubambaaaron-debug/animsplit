import { Link } from 'react-router-dom';

export default function Header({ back, backLabel = 'Back', title, action }) {
  return (
    <header className="border-b border-border bg-panel/90 backdrop-blur sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-5 h-13 flex items-center gap-4" style={{ height: '52px' }}>

        {back ? (
          <Link
            to={back}
            className="text-muted hover:text-cyan transition-colors text-sm flex items-center gap-1.5 shrink-0"
          >
            <span className="text-lg leading-none">‹</span> {backLabel}
          </Link>
        ) : (
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-cyan/10 border border-cyan/30 flex items-center justify-center text-sm">
              🎬
            </div>
            <span className="font-semibold text-white tracking-tight">
              Macrometro <span className="text-cyan">Animation</span>
            </span>
          </Link>
        )}

        {title && (
          <span className="text-muted text-sm font-medium truncate flex-1 pl-2 border-l border-border ml-1">
            {title}
          </span>
        )}

        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
    </header>
  );
}
