import React from 'react';
import { X } from 'lucide-react';
import { formatMissionTime } from '../game/rules';
import type { AudioSettings, RunSummary } from '../game/types';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onControls: () => void;
  onMainMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onControls,
  onMainMenu,
}) => (
  <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#070B18]/80 p-6">
    <div className="w-full max-w-sm bg-[#10192B] border border-[#00D9FF]/45 rounded p-6 shadow-2xl">
      <h2 className="font-display text-2xl font-bold tracking-wider uppercase text-white">
        Mission Paused
      </h2>
      <p className="text-xs text-slate-400 mt-1">Simulation suspended</p>

      <div className="mt-6 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onResume}
          className="w-full py-3 bg-[#00D9FF] text-[#070B18] font-display font-bold uppercase tracking-wider text-sm rounded hover:bg-[#38e4ff] cursor-pointer"
        >
          Resume
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="w-full py-2.5 bg-[#070B18] border border-slate-700 hover:border-[#FFC857] text-slate-100 font-display font-semibold uppercase tracking-wider text-xs rounded cursor-pointer"
        >
          Restart Mission
        </button>
        <button
          type="button"
          onClick={onControls}
          className="w-full py-2.5 bg-[#070B18] border border-slate-700 hover:border-[#00D9FF] text-slate-100 font-display font-semibold uppercase tracking-wider text-xs rounded cursor-pointer"
        >
          Controls
        </button>
        <button
          type="button"
          onClick={onMainMenu}
          className="w-full py-2.5 bg-[#070B18] border border-slate-700 hover:border-[#FF3459] text-slate-300 font-display font-semibold uppercase tracking-wider text-xs rounded cursor-pointer"
        >
          Main Menu
        </button>
      </div>
    </div>
  </div>
);

interface EndScreenModalProps {
  summary: RunSummary;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

export const EndScreenModal: React.FC<EndScreenModalProps> = ({
  summary,
  onPlayAgain,
  onMainMenu,
}) => {
  const isWin = summary.victory;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#070B18]/85 p-6">
      <div
        className={`w-full max-w-md bg-[#10192B] border rounded p-7 shadow-2xl ${
          isWin ? 'border-[#00D9FF]/60' : 'border-[#FF3459]/60'
        }`}
      >
        <div
          className={`text-xs font-mono-num uppercase tracking-widest ${
            isWin ? 'text-[#00D9FF]' : 'text-[#FF3459]'
          }`}
        >
          {isWin ? 'Sector 09 Power Network Restored' : 'Guardian Signal Lost'}
        </div>
        <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-white mt-1">
          {isWin ? 'Mission Completed' : 'Mission Failed'}
        </h2>
        <p className="text-sm text-slate-300 mt-2">
          {isWin
            ? 'The Shadow Guardian has been neutralized and the Central Reactor is back online.'
            : 'SHADOW defense units overwhelmed your suit before the Central Reactor could be restored.'}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="bg-[#070B18] border border-slate-800 rounded p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Final Score</div>
            <div className="font-mono-num text-xl font-bold text-[#FFC857] mt-0.5">
              {summary.score}
            </div>
          </div>
          <div className="bg-[#070B18] border border-slate-800 rounded p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Total Time</div>
            <div className="font-mono-num text-xl font-bold text-white mt-0.5">
              {formatMissionTime(summary.elapsedTime)}
            </div>
          </div>
          <div className="bg-[#070B18] border border-slate-800 rounded p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Enemies Defeated</div>
            <div className="font-mono-num text-xl font-bold text-white mt-0.5">
              {summary.enemiesDefeated}
            </div>
          </div>
          <div className="bg-[#070B18] border border-slate-800 rounded p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Energy Cores</div>
            <div className="font-mono-num text-xl font-bold text-[#00D9FF] mt-0.5">
              {summary.coresCollected}/{summary.totalCores}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="flex-1 py-3 bg-[#00D9FF] text-[#070B18] font-display font-bold uppercase tracking-wider text-sm rounded hover:bg-[#38e4ff] cursor-pointer"
          >
            {isWin ? 'Play Again' : 'Try Again'}
          </button>
          <button
            type="button"
            onClick={onMainMenu}
            className="flex-1 py-3 bg-[#070B18] border border-slate-700 hover:border-slate-500 text-slate-200 font-display font-semibold uppercase tracking-wider text-xs rounded cursor-pointer"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};

interface ControlsModalProps {
  onClose: () => void;
}

export const ControlsModal: React.FC<ControlsModalProps> = ({ onClose }) => {
  const bindings = [
    ['W A S D', 'Move Guardian'],
    ['Mouse / Arrows', 'Aim & Rotate Camera'],
    ['Left Click', 'Fire Plasma Rifle'],
    ['Space', 'Jump'],
    ['Shift', 'Evade Dash'],
    ['Q', 'Echo Shift (Reality / Shadow Mode)'],
    ['E', 'Interact / Activate Reactor'],
    ['R', 'Reload Rifle'],
    ['M', 'Mute / Unmute Audio'],
    ['Esc / P', 'Pause Mission'],
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#070B18]/85 p-6">
      <div className="w-full max-w-lg bg-[#10192B] border border-[#00D9FF]/45 rounded p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold uppercase tracking-wider text-white">
            How to Play &amp; Controls
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close controls"
            className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 mt-3 leading-relaxed">
          Use <span className="text-[#A855F7] font-semibold">Echo Shift (Q)</span> to phase
          between Reality and Shadow Mode. Shadow Mode passes through Reality barriers,
          solidifies purple Echo Bridges, reveals hidden Energy Cores, and exposes the weak
          points on Shadow Sentinels and the Boss!
        </p>

        <div className="mt-4 divide-y divide-slate-800 border-t border-b border-slate-800">
          {bindings.map(([key, action]) => (
            <div key={key} className="flex items-center justify-between py-2 text-xs">
              <span className="font-mono-num text-[#00D9FF] font-semibold">{key}</span>
              <span className="text-slate-200">{action}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-2.5 bg-[#00D9FF] text-[#070B18] font-display font-bold uppercase tracking-wider text-xs rounded hover:bg-[#38e4ff] cursor-pointer"
        >
          Got It
        </button>
      </div>
    </div>
  );
};

interface SettingsModalProps {
  settings: AudioSettings;
  onChange: (next: Partial<AudioSettings>) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onChange,
  onClose,
}) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#070B18]/85 p-6">
    <div className="w-full max-w-md bg-[#10192B] border border-[#A855F7]/50 rounded p-6 shadow-2xl">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold uppercase tracking-wider text-white">
          Audio &amp; Controls Settings
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-5 space-y-4 text-xs">
        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span>Music Volume</span>
            <span className="font-mono-num">{Math.round(settings.musicVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.musicVolume}
            onChange={(e) => onChange({ musicVolume: parseFloat(e.target.value) })}
            className="w-full scifi-range"
          />
        </div>

        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span>Sound Effects Volume</span>
            <span className="font-mono-num">{Math.round(settings.sfxVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.sfxVolume}
            onChange={(e) => onChange({ sfxVolume: parseFloat(e.target.value) })}
            className="w-full scifi-range"
          />
        </div>

        <div>
          <div className="flex justify-between text-slate-300 mb-1">
            <span>Mouse Sensitivity</span>
            <span className="font-mono-num">{settings.mouseSensitivity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.4"
            max="2.2"
            step="0.1"
            value={settings.mouseSensitivity}
            onChange={(e) => onChange({ mouseSensitivity: parseFloat(e.target.value) })}
            className="w-full scifi-range"
          />
        </div>

        <label className="flex items-center justify-between pt-2 border-t border-slate-800 cursor-pointer">
          <span className="text-slate-200 font-medium">Mute All Audio</span>
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(e) => onChange({ muted: e.target.checked })}
            className="w-4 h-4 accent-[#00D9FF]"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-6 w-full py-2.5 bg-[#00D9FF] text-[#070B18] font-display font-bold uppercase tracking-wider text-xs rounded hover:bg-[#38e4ff] cursor-pointer"
      >
        Save &amp; Close
      </button>
    </div>
  </div>
);

interface CreditsModalProps {
  onClose: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ onClose }) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#070B18]/85 p-6">
    <div className="w-full max-w-md bg-[#10192B] border border-slate-700 rounded p-6 shadow-2xl">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold uppercase tracking-wider text-white">
          Credits
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close credits"
          className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="mt-4 space-y-3 text-xs text-slate-300 leading-relaxed">
        <p className="text-white font-display text-sm uppercase tracking-wider">
          SHADOW PROTOCOL: Echoes of the Last Light
        </p>
        <p>
          Built with Three.js PBR rendering, procedural 3D robotics &amp; cityscape
          architecture, Web Audio API synthesis, and dual-dimension Echo Shift gameplay.
        </p>
        <p className="text-slate-400">
          Zero external asset servers · 100% procedural WebGL &amp; audio pipeline.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-display font-semibold uppercase tracking-wider text-xs rounded cursor-pointer"
      >
        Close
      </button>
    </div>
  </div>
);
