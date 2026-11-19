import { BookOpen } from 'lucide-react';

interface WebsiteLoaderProps {
  progress: number;
  statusLabel: string;
}

export function WebsiteLoader({ progress, statusLabel }: WebsiteLoaderProps) {
  const clamped = Math.min(100, Math.max(8, Math.round(progress)));

  return (
    <div
      className="min-h-screen bg-[#211e18] text-[#eee2ca] flex flex-col items-center justify-center px-6 field-stage"
      role="status"
      aria-live="polite"
      aria-label="Loading SmartLib AI"
    >
      <div className="w-full max-w-md bg-[#29251d] border border-[#3a382b] rounded-sm p-8">
        <div className="flex items-center justify-between gap-4 pb-6 mb-6 border-b border-[#3a382b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1d1a15] border border-[#3a382b] rounded-sm flex items-center justify-center text-[#c3a47b]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#c3a47b]">
                Academic Portal
              </div>
              <h1 className="text-2xl font-display italic font-semibold tracking-tight text-[#eee2ca]">
                SmartLib AI
              </h1>
            </div>
          </div>
          <span className="text-xs font-mono text-[#c5b79e] tabular-nums">{clamped}%</span>
        </div>

        <p className="text-sm text-[#c5b79e] leading-relaxed mb-5">
          Intelligent College Library &amp; Multi-Agent Workspace
        </p>

        {/* Hairline Brass Progress Track */}
        <div className="w-full h-1.5 bg-[#1d1a15] border border-[#3a382b] rounded-sm overflow-hidden mb-4">
          <div
            className="h-full bg-[#c3a47b] transition-all duration-200 ease-out"
            style={{ width: `${clamped}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-[#c5b79e]">{statusLabel}</span>
          <span className="font-mono text-[11px] text-[#c3a47b]">SQLite · 7 Agents</span>
        </div>
      </div>
    </div>
  );
}
