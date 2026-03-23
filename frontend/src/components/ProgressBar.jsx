export default function ProgressBar({ value = 0, label, sublabel, color = 'cyan' }) {
  const colors = {
    cyan:    'bg-cyan',
    success: 'bg-success',
    warning: 'bg-warning',
    danger:  'bg-danger',
  };

  return (
    <div className="w-full">
      {(label || sublabel) && (
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-slate-300">{label}</span>
          <span className="text-muted font-mono">{sublabel}</span>
        </div>
      )}
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colors[color] || colors.cyan}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
