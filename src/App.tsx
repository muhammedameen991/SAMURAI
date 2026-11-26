import { useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { PauseModal, TitleScreen } from './components/MenuOverlays';
import { SettingsModal } from './components/SettingsModal';
import { GameEngine } from './game/GameEngine';
import { hasSaveData } from './game/save';
import { loadSettings } from './game/settings';
import { GameScreen, GameSettings, HudSnapshot } from './game/types';
import { detectHardwareProfile } from './game/utils';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [screen, setScreen] = useState<GameScreen>('menu');
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [saveAvailable, setSaveAvailable] = useState(() => hasSaveData());
  const [isLowEndDetected] = useState(() => detectHardwareProfile().isLowEnd);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new GameEngine(
      container,
      settings,
      (snapshot) => setHud(snapshot),
      (nextScreen) => {
        setScreen(nextScreen);
        setSaveAvailable(hasSaveData());
      }
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // Initialize WebGL engine once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enter / Space shortcut on Title Screen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== 'menu' || showSettings || showCredits) return;
      if (e.code === 'Enter') {
        if (hasSaveData()) {
          engineRef.current?.continueGame();
        } else {
          engineRef.current?.startNewGame();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, showSettings, showCredits]);

  const handleSettingsChange = (next: GameSettings) => {
    setSettings(next);
    engineRef.current?.updateSettings(next);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#09090b]">
      {/* Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Title Screen */}
      {screen === 'menu' && !showSettings && !showCredits && (
        <TitleScreen
          hasSave={saveAvailable}
          onNewGame={() => engineRef.current?.startNewGame()}
          onContinue={() => engineRef.current?.continueGame()}
          onOpenSettings={() => {
            engineRef.current?.audio.playUiClick();
            setShowSettings(true);
          }}
          onOpenCredits={() => {
            engineRef.current?.audio.playUiClick();
            setShowCredits(true);
          }}
        />
      )}

      {/* Active Gameplay HUD */}
      {screen === 'playing' && hud && (
        <GameHud
          hud={hud}
          showFps={settings.showFps}
          onCloseDialogue={() => engineRef.current?.closeDialogue()}
          onDialogueAction={(actionId) => engineRef.current?.handleDialogueAction(actionId)}
        />
      )}

      {/* Pause Menu & Mission Journal */}
      {screen === 'paused' && !showSettings && engineRef.current && (
        <PauseModal
          missions={engineRef.current.missions.missions}
          activeMissionId={engineRef.current.missions.activeMissionId}
          onSelectMission={(id) => engineRef.current?.setActiveMission(id)}
          onResume={() => engineRef.current?.resumeGame()}
          onSave={() => {
            engineRef.current?.saveGame();
            engineRef.current?.audio.playPickup();
            setSaveAvailable(true);
          }}
          onOpenSettings={() => {
            engineRef.current?.audio.playUiClick();
            setShowSettings(true);
          }}
          onRestart={() => engineRef.current?.startNewGame()}
          onMainMenu={() => {
            engineRef.current?.saveGame();
            setSaveAvailable(hasSaveData());
            engineRef.current?.setScreen('menu');
          }}
        />
      )}

      {/* Game Over Modal */}
      {screen === 'gameover' && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center p-4"
          style={{ background: 'rgba(12, 4, 4, 0.84)' }}
        >
          <div
            className="w-full max-w-md rounded border border-[#dc2626]/60 p-7 text-center shadow-2xl"
            style={{ background: 'rgba(12, 10, 12, 0.96)' }}
          >
            <h2 className="font-display text-3xl text-[#ef4444] tracking-wider mb-2">
              Defeated
            </h2>
            <p className="text-sm text-[#d6cfc2] mb-6">
              Your blade fell in battle, yet the spirit of the samurai endures. Rise again at the nearest sanctuary shrine.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => engineRef.current?.respawnAtCheckpoint()}
                className="py-3 px-5 rounded bg-[#b91c1c] hover:bg-[#dc2626] text-white text-sm font-semibold cursor-pointer"
              >
                Rise at Shrine
              </button>
              <button
                onClick={() => engineRef.current?.setScreen('menu')}
                className="py-2.5 px-5 rounded border border-white/15 hover:bg-white/10 text-[#d6cfc2] text-sm cursor-pointer"
              >
                Return to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory Modal */}
      {screen === 'victory' && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center p-4"
          style={{ background: 'rgba(8, 8, 10, 0.84)' }}
        >
          <div
            className="w-full max-w-lg rounded border border-[#d4a441]/60 p-8 text-center shadow-2xl"
            style={{ background: 'rgba(12, 11, 14, 0.96)' }}
          >
            <div className="text-xs tracking-[0.25em] text-[#d4a441] uppercase mb-2">
              Peace Restored to the Valley
            </div>
            <h2 className="font-display text-3xl text-[#f5f0e6] mb-3">
              Shadow of the Shogun Cleared
            </h2>
            <p className="text-sm text-[#d6cfc2] leading-relaxed mb-6">
              You defended Kurokawa Village, freed the captives of Crimson Skull Camp, recovered the ancestral blade, and defeated Kuroda atop Kurogane Mountain Path.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => engineRef.current?.resumeGame()}
                className="py-2.5 px-5 rounded bg-[#b91c1c] hover:bg-[#dc2626] text-white text-sm font-medium cursor-pointer"
              >
                Continue Exploring
              </button>
              <button
                onClick={() => engineRef.current?.setScreen('menu')}
                className="py-2.5 px-5 rounded border border-[#d4a441]/40 hover:bg-white/10 text-[#f5f0e6] text-sm cursor-pointer"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          isLowEndDetected={isLowEndDetected}
          onChange={handleSettingsChange}
          onClose={() => {
            engineRef.current?.audio.playUiClick();
            setShowSettings(false);
          }}
        />
      )}

      {/* Credits Modal */}
      {showCredits && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center p-4"
          style={{ background: 'rgba(6, 6, 8, 0.82)' }}
        >
          <div
            className="w-full max-w-md rounded border border-[#d4a441]/40 p-6 shadow-2xl"
            style={{ background: 'rgba(12, 11, 14, 0.96)' }}
          >
            <h2 className="font-display text-xl text-[#f5f0e6] mb-1">Credits</h2>
            <p className="text-xs text-[#d4a441] mb-4">Samurai: Shadow of the Shogun</p>
            <div className="space-y-2 text-xs text-[#d6cfc2] leading-relaxed mb-5">
              <p>3D Rendering: Three.js WebGL with procedural PBR materials and dynamic sky atmosphere.</p>
              <p>Audio Synthesis: Procedural Web Audio API katana clashes, Hirajoshi koto, wind, and nature ambience.</p>
              <p>Persistence: Client-side LocalStorage save & graphics configuration.</p>
            </div>
            <button
              onClick={() => {
                engineRef.current?.audio.playUiClick();
                setShowCredits(false);
              }}
              className="w-full py-2.5 rounded border border-[#d4a441]/40 hover:bg-white/10 text-xs font-medium text-[#f5f0e6] cursor-pointer"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
