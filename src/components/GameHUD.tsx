import React from 'react';
import { Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { formatMissionTime } from '../game/rules';
import type { HudSnapshot } from '../game/types';

interface GameHUDProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  muted,
  onToggleMute,
  onPause,
  onRestart,
}) => {
  const isShadow = hud.dimension === 'shadow';
  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const echoPct = Math.max(0, Math.min(100, (hud.echoEnergy / hud.maxEchoEnergy) * 100));
  const bossPct = hud.boss.maxHp > 0 ? Math.max(0, (hud.boss.hp / hud.boss.maxHp) * 100) : 0;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Screen Distortion & Dimension Vignette */}
      {isShadow && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 110px rgba(168, 85, 247, 0.35)',
            border: '2px solid rgba(168, 85, 247, 0.35)',
          }}
        />
      )}
      {hud.echoTransition > 0.05 && (
        <div
          className="fixed inset-0 pointer-events-none animate-echo-burst"
          style={{
            background: isShadow
              ? 'radial-gradient(circle, transparent 40%, rgba(168, 85, 247, 0.45) 100%)'
              : 'radial-gradient(circle, transparent 40%, rgba(0, 217, 255, 0.42) 100%)',
          }}
        />
      )}
      {hud.damageFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            opacity: hud.damageFlash * 0.65,
            boxShadow: 'inset 0 0 130px rgba(255, 52, 89, 0.85)',
          }}
        />
      )}

      {/* TOP-LEFT: Zone, Mission Objective & Energy Cores */}
      <div className="fixed top-4 left-4 max-w-sm bg-[#10192B]/90 border border-[#00D9FF]/30 rounded px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between gap-4 text-[11px] font-mono-num text-[#00D9FF] uppercase tracking-wider">
          <span>{hud.zoneName}</span>
          <span>{formatMissionTime(hud.elapsedTime)}</span>
        </div>
        <div className="mt-1 text-sm font-semibold text-white leading-snug">
          {hud.objectiveText}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">Cores</span>
            <div className="flex items-center gap-1.5" aria-label={`Energy cores ${hud.coresCollected} of ${hud.totalCores}`}>
              {[0, 1, 2].map((idx) => {
                const filled = idx < hud.coresCollected;
                return (
                  <svg key={idx} viewBox="0 0 20 20" className="w-4 h-4">
                    <polygon
                      points="10,1 19,10 10,19 1,10"
                      fill={filled ? '#FFC857' : 'transparent'}
                      stroke={filled ? '#FFC857' : '#475569'}
                      strokeWidth="1.8"
                    />
                  </svg>
                );
              })}
            </div>
            <span className="font-mono-num text-[#FFC857] font-bold">
              {hud.coresCollected}/{hud.totalCores}
            </span>
          </div>
          <div className="font-mono-num text-slate-300">
            SCORE <span className="text-white font-bold">{hud.score}</span>
          </div>
        </div>
      </div>

      {/* TOP-CENTER: Boss Health Bar OR Targeted Enemy Health */}
      {hud.boss.active ? (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[min(460px,90vw)] bg-[#10192B]/92 border border-[#FF3459]/50 rounded px-4 py-2.5">
          <div className="flex items-center justify-between text-xs font-display tracking-wider uppercase">
            <span className="text-[#FF3459] font-bold">{hud.boss.name}</span>
            <span className="font-mono-num text-slate-300">
              Phase {hud.boss.phase}
              {hud.boss.shieldActive
                ? hud.boss.weakPointExposed
                  ? ' · Weak Point Exposed'
                  : ' · Shielded (Press Q)'
                : ''}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 w-full bg-[#070B18] rounded-sm overflow-hidden border border-slate-700">
            <div
              className="h-full transition-all duration-100"
              style={{
                width: `${bossPct}%`,
                backgroundColor: hud.boss.weakPointExposed ? '#FFC857' : '#FF3459',
              }}
            />
          </div>
        </div>
      ) : (
        hud.targetEnemy &&
        hud.targetEnemy.hp > 0 && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 w-64 bg-[#10192B]/88 border border-slate-700 rounded px-3.5 py-2">
            <div className="flex items-center justify-between text-[11px] font-display uppercase tracking-wider">
              <span className="text-slate-100 font-semibold">{hud.targetEnemy.name}</span>
              <span className="font-mono-num text-slate-300">
                {hud.targetEnemy.armored
                  ? 'Armored (Use Q)'
                  : hud.targetEnemy.weakPointExposed
                  ? 'Weak Point'
                  : `${Math.round(hud.targetEnemy.hp)} HP`}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-[#070B18] rounded-sm overflow-hidden">
              <div
                className="h-full bg-[#FF3459] transition-all duration-75"
                style={{
                  width: `${Math.max(0, (hud.targetEnemy.hp / hud.targetEnemy.maxHp) * 100)}%`,
                }}
              />
            </div>
          </div>
        )
      )}

      {/* TOP-RIGHT: Compact Utility Controls */}
      <div className="fixed top-4 right-4 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Unmute audio [M]' : 'Mute audio [M]'}
          title="Mute / Unmute (M)"
          className="w-10 h-10 flex items-center justify-center rounded bg-[#10192B]/90 border border-slate-700 hover:border-[#00D9FF] text-slate-200 cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4 text-[#FF3459]" /> : <Volume2 className="w-4 h-4 text-[#00D9FF]" />}
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onRestart();
          }}
          aria-label="Restart mission"
          title="Restart Mission"
          className="w-10 h-10 flex items-center justify-center rounded bg-[#10192B]/90 border border-slate-700 hover:border-[#FFC857] text-slate-200 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onPause();
          }}
          aria-label="Pause game [Esc]"
          title="Pause (Esc)"
          className="w-10 h-10 flex items-center justify-center rounded bg-[#10192B]/90 border border-slate-700 hover:border-[#00D9FF] text-slate-200 cursor-pointer"
        >
          <Pause className="w-4 h-4" />
        </button>
      </div>

      {/* CENTER CROSSHAIR & HIT MARKER */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg viewBox="0 0 40 40" className="w-9 h-9">
          <circle
            cx="20"
            cy="20"
            r="2"
            fill={isShadow ? '#A855F7' : '#00D9FF'}
          />
          <line x1="20" y1="6" x2="20" y2="13" stroke={isShadow ? '#A855F7' : '#00D9FF'} strokeWidth="1.6" strokeOpacity="0.85" />
          <line x1="20" y1="27" x2="20" y2="34" stroke={isShadow ? '#A855F7' : '#00D9FF'} strokeWidth="1.6" strokeOpacity="0.85" />
          <line x1="6" y1="20" x2="13" y2="20" stroke={isShadow ? '#A855F7' : '#00D9FF'} strokeWidth="1.6" strokeOpacity="0.85" />
          <line x1="27" y1="20" x2="34" y2="20" stroke={isShadow ? '#A855F7' : '#00D9FF'} strokeWidth="1.6" strokeOpacity="0.85" />

          {hud.hitMarkerTimer > 0 && (
            <g stroke={hud.critMarker ? '#FFC857' : '#FF3459'} strokeWidth="2.2">
              <line x1="11" y1="11" x2="16" y2="16" />
              <line x1="29" y1="11" x2="24" y2="16" />
              <line x1="11" y1="29" x2="16" y2="24" />
              <line x1="29" y1="29" x2="24" y2="24" />
            </g>
          )}
        </svg>
      </div>

      {/* INTERACTION PROMPT / POINTER LOCK GUIDE */}
      {hud.interactPrompt && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-[#10192B]/95 border border-[#FFC857] text-[#FFC857] font-display font-semibold tracking-wider uppercase text-xs px-5 py-2 rounded">
          {hud.interactPrompt}
        </div>
      )}
      {!hud.pointerLocked && !hud.interactPrompt && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 text-[11px] font-mono-num text-slate-400 bg-[#070B18]/75 px-3 py-1 rounded">
          Click arena to aim &amp; fire · Q Echo Shift · Shift Dash
        </div>
      )}

      {/* BOTTOM-LEFT: Health & Echo Shift Meter */}
      <div className="fixed bottom-4 left-4 w-68 bg-[#10192B]/90 border border-slate-700/80 rounded px-4 py-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-display uppercase tracking-wider text-slate-400">Armor Integrity</span>
          <span className="font-mono-num text-sm font-bold text-white">
            {hud.hp} <span className="text-slate-500 text-xs">/ {hud.maxHp}</span>
          </span>
        </div>
        <div className="mt-1 h-2 w-full bg-[#070B18] rounded-sm overflow-hidden border border-slate-800">
          <div
            className="h-full transition-all duration-100"
            style={{
              width: `${hpPct}%`,
              backgroundColor: hpPct <= 30 ? '#FF3459' : '#00D9FF',
            }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span
            className="font-display uppercase tracking-wider font-semibold"
            style={{ color: isShadow ? '#A855F7' : '#00D9FF' }}
          >
            {isShadow ? 'Shadow Mode [Q] · Reveal' : 'Reality Mode [Q] · Survive'}
          </span>
          <span className="font-mono-num text-slate-300">
            {hud.echoCooldown > 0 ? `${hud.echoCooldown}s` : `${hud.echoEnergy}%`}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full bg-[#070B18] rounded-sm overflow-hidden border border-slate-800">
          <div
            className="h-full transition-all duration-75"
            style={{
              width: `${echoPct}%`,
              backgroundColor: isShadow ? '#A855F7' : '#38BDF8',
            }}
          />
        </div>
      </div>

      {/* BOTTOM-RIGHT: Weapon Ammo & Dash Readiness */}
      <div className="fixed bottom-4 right-4 bg-[#10192B]/90 border border-slate-700/80 rounded px-4 py-3 text-right min-w-44">
        <div className="text-[11px] font-display uppercase tracking-wider text-slate-400">
          Plasma Rifle
        </div>
        <div className="font-mono-num text-2xl font-bold text-white leading-tight mt-0.5">
          {hud.reloading ? (
            <span className="text-sm text-[#FFC857] uppercase tracking-wider">Reloading...</span>
          ) : (
            <>
              {hud.ammo}
              <span className="text-sm text-slate-500 font-normal"> / {hud.maxAmmo}</span>
            </>
          )}
        </div>
        <div className="mt-1.5 text-[11px] font-mono-num text-slate-400">
          {hud.dashCooldown > 0 ? `Dash ${hud.dashCooldown}s` : 'Dash [Shift] Ready'} · R Reload
        </div>
      </div>
    </div>
  );
};
