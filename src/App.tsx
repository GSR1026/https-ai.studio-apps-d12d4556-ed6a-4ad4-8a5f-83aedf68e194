import { useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import {
  ControlsModal,
  CreditsModal,
  EndScreenModal,
  PauseModal,
  SettingsModal,
} from './components/Overlays';
import { TitleScreen } from './components/TitleScreen';
import { ShadowProtocolEngine } from './game/engine';
import type { AudioSettings, GamePhase, HudSnapshot, RunSummary } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  dimension: 'reality',
  echoEnergy: 100,
  maxEchoEnergy: 100,
  echoCooldown: 0,
  echoTransition: 0,
  hp: 100,
  maxHp: 100,
  ammo: 24,
  maxAmmo: 24,
  reloading: false,
  dashCooldown: 0,
  coresCollected: 0,
  totalCores: 3,
  reactorGateOpen: false,
  reactorActivated: false,
  currentZone: 'fallen_city',
  zoneName: 'Zone 1: The Fallen City',
  objectiveText: 'Locate Energy Core 1/3 in The Fallen City',
  interactPrompt: null,
  score: 0,
  enemiesDefeated: 0,
  elapsedTime: 0,
  hitMarkerTimer: 0,
  critMarker: false,
  damageFlash: 0,
  pointerLocked: false,
  targetEnemy: null,
  boss: {
    active: false,
    name: 'THE SHADOW GUARDIAN',
    hp: 650,
    maxHp: 650,
    phase: 1,
    shieldActive: false,
    weakPointExposed: false,
  },
  playerPos: { x: 0, z: 42, yaw: 0 },
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ShadowProtocolEngine | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [activeDialog, setActiveDialog] = useState<'controls' | 'settings' | 'credits' | null>(null);
  const [settings, setSettings] = useState<AudioSettings>({
    musicVolume: 0.45,
    sfxVolume: 0.7,
    muted: false,
    mouseSensitivity: 1.0,
  });

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new ShadowProtocolEngine(mountEl, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onPhaseChange: (nextPhase) => setPhase(nextPhase),
      onRunComplete: (summary) => setRunSummary(summary),
    });
    engineRef.current = engine;

    // Support ?autostart=1 for automated testing and quick launch
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startMission();
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStart = () => {
    setRunSummary(null);
    setActiveDialog(null);
    (document.activeElement as HTMLElement | null)?.blur?.();
    engineRef.current?.startMission();
  };

  const handleRestart = () => {
    setRunSummary(null);
    setActiveDialog(null);
    (document.activeElement as HTMLElement | null)?.blur?.();
    engineRef.current?.restartMission();
  };

  const handleSettingsChange = (next: Partial<AudioSettings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      engineRef.current?.updateSettings(merged);
      return merged;
    });
  };

  const handleToggleMute = () => {
    handleSettingsChange({ muted: !settings.muted });
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#070B18]">
      {/* Isolated WebGL canvas mount container */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 w-full h-full"
      />

      {phase === 'title' && (
        <TitleScreen
          onStart={handleStart}
          onOpenControls={() => setActiveDialog('controls')}
          onOpenSettings={() => setActiveDialog('settings')}
          onOpenCredits={() => setActiveDialog('credits')}
        />
      )}

      {(phase === 'playing' || phase === 'paused') && (
        <GameHUD
          hud={hud}
          muted={settings.muted}
          onToggleMute={handleToggleMute}
          onPause={() => engineRef.current?.pauseGame()}
          onRestart={handleRestart}
        />
      )}

      {phase === 'paused' && !activeDialog && (
        <PauseModal
          onResume={() => engineRef.current?.resumeGame()}
          onRestart={handleRestart}
          onControls={() => setActiveDialog('controls')}
          onMainMenu={() => {
            setActiveDialog(null);
            engineRef.current?.returnToTitle();
          }}
        />
      )}

      {(phase === 'victory' || phase === 'gameover') && runSummary && (
        <EndScreenModal
          summary={runSummary}
          onPlayAgain={handleRestart}
          onMainMenu={() => {
            setRunSummary(null);
            engineRef.current?.returnToTitle();
          }}
        />
      )}

      {activeDialog === 'controls' && (
        <ControlsModal onClose={() => setActiveDialog(null)} />
      )}
      {activeDialog === 'settings' && (
        <SettingsModal
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setActiveDialog(null)}
        />
      )}
      {activeDialog === 'credits' && (
        <CreditsModal onClose={() => setActiveDialog(null)} />
      )}
    </main>
  );
}
