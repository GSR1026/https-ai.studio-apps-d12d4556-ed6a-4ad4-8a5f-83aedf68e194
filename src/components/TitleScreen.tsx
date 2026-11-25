import React, { useState } from 'react';
import { BookOpen, Eye, Play, Settings, Shield, Users } from 'lucide-react';

interface TitleScreenProps {
  onStart: () => void;
  onOpenControls: () => void;
  onOpenSettings: () => void;
  onOpenCredits: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  onOpenControls,
  onOpenSettings,
  onOpenCredits,
}) => {
  const [showLive3d, setShowLive3d] = useState(false);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none">
      {/* Uploaded Key-Art Poster Stage (toggled off when viewing Live 3D Flyover) */}
      {!showLive3d && (
        <div className="fixed inset-0 bg-[#070B18] pointer-events-none">
          <img
            src="/assets/aistudio/Shadow_Protocol__Echoes_of_the_Last_Light_6ad05192.png"
            alt="Shadow Protocol: Echoes of the Last Light key art"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-[center_32%]"
          />
          {/* Subtle bottom gradient scrim so the interactive command dock blends seamlessly */}
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#070B18] via-[#070B18]/85 to-transparent" />
        </div>
      )}

      {/* Semantic H1 for screen readers & snapshots */}
      <h1 className="sr-only">SHADOW PROTOCOL — Echoes of the Last Light</h1>

      {/* Top Bar: Quiet mode switch to preview Live 3D World */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-4">
        <div className="flex items-center gap-2 text-[11px] font-mono-num tracking-[0.22em] text-[#00D9FF] uppercase bg-[#070B18]/80 px-3 py-1.5 border border-[#00D9FF]/30 rounded-sm">
          <Shield className="w-3.5 h-3.5" />
          <span>Sector 09 · Year 2099</span>
        </div>

        <button
          type="button"
          onClick={() => setShowLive3d((v) => !v)}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 text-xs font-display font-semibold uppercase tracking-wider text-slate-200 bg-[#070B18]/85 border border-slate-700 hover:border-[#00D9FF] rounded-sm transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-[#00D9FF]" />
          <span>{showLive3d ? 'Show Poster Art' : 'Preview 3D World'}</span>
        </button>
      </div>

      {/* When previewing 3D world, display clean left-third title lockup */}
      {showLive3d && (
        <div className="relative z-10 max-w-lg px-8 md:px-14 my-auto pointer-events-none">
          <div className="text-xs font-mono-num tracking-[0.26em] text-[#A855F7] uppercase mb-2">
            Two Dimensions · One Battle
          </div>
          <div className="font-display text-5xl md:text-6xl font-bold tracking-tight text-white leading-none">
            SHADOW PROTOCOL
          </div>
          <p className="font-display text-lg tracking-[0.22em] text-[#00D9FF] mt-2 uppercase">
            Echoes of the Last Light
          </p>
          <p className="text-sm text-slate-300 mt-3 max-w-md leading-relaxed">
            Explore the fallen metropolis in Reality Mode, phase into Shadow Mode with Q
            to uncover hidden cores and weak points, and restore the Central Reactor.
          </p>
        </div>
      )}

      {/* Bottom Interactive Command Dock (matches poster's chamfered neon-cyan/purple footer) */}
      <div className="relative z-10 mt-auto w-full bg-[#070B18]/92 border-t border-[#00D9FF]/45 px-6 md:px-10 py-4 pointer-events-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Game tagline */}
          <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono-num tracking-widest text-slate-400 uppercase">
            <span className="text-[#00D9FF] font-semibold">Reality Mode</span>
            <span>·</span>
            <span className="text-[#A855F7] font-semibold">Shadow Mode</span>
            <span>·</span>
            <span>3D Action-Adventure</span>
          </div>

          {/* Center: Chamfered PLAY NOW CTA + Secondary Menu Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              style={{
                clipPath:
                  'polygon(14px 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 14px 100%, 0 50%)',
              }}
              className="flex items-center justify-center gap-2.5 px-10 py-3 bg-[#00D9FF] text-[#070B18] font-display font-bold tracking-[0.18em] uppercase text-base hover:bg-[#4ee6ff] transition-colors cursor-pointer whitespace-nowrap shadow-[0_0_26px_rgba(0,217,255,0.45)]"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play Now</span>
            </button>

            <button
              type="button"
              onClick={onOpenControls}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#10192B] text-slate-100 border border-[#00D9FF]/40 hover:border-[#00D9FF] font-display font-semibold tracking-wider uppercase text-xs rounded-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4 text-[#00D9FF]" />
              <span>How to Play</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#10192B] text-slate-100 border border-[#A855F7]/40 hover:border-[#A855F7] font-display font-semibold tracking-wider uppercase text-xs rounded-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-4 h-4 text-[#A855F7]" />
              <span>Settings</span>
            </button>

            <button
              type="button"
              onClick={onOpenCredits}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#10192B] text-slate-100 border border-slate-700 hover:border-slate-500 font-display font-semibold tracking-wider uppercase text-xs rounded-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Users className="w-4 h-4 text-slate-400" />
              <span>Credits</span>
            </button>
          </div>

          {/* Right: Compact control reminder */}
          <div className="text-[11px] font-mono-num tracking-wider text-slate-400 uppercase whitespace-nowrap">
            Explore · Fight · Transform
          </div>
        </div>
      </div>
    </div>
  );
};
