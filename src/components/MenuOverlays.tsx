import React from 'react';
import { Mission } from '../game/types';

interface TitleScreenProps {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
  onOpenSettings: () => void;
  onOpenCredits: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSave,
  onNewGame,
  onContinue,
  onOpenSettings,
  onOpenCredits,
}) => {
  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-8 sm:p-14"
      style={{
        background:
          'linear-gradient(90deg, rgba(8,8,10,0.88) 0%, rgba(8,8,10,0.52) 48%, rgba(8,8,10,0.18) 100%)',
      }}
    >
      <div />

      <div className="max-w-lg animate-fade-slide-up">
        {/* Bespoke inline SVG Feudal Crest (Mon) & Title Lockup */}
        <div className="flex items-center gap-4 mb-5">
          <svg width="56" height="56" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <circle cx="32" cy="32" r="28" stroke="#d4a441" strokeWidth="2.5" />
            <circle cx="32" cy="32" r="22" stroke="#b91c1c" strokeWidth="1.5" />
            <path d="M18 18 L46 46 M46 18 L18 46" stroke="#f5f0e6" strokeWidth="3" strokeLinecap="round" />
            <circle cx="32" cy="32" r="6" fill="#b91c1c" stroke="#d4a441" strokeWidth="1.8" />
          </svg>
          <div>
            <div className="text-xs tracking-[0.28em] text-[#d4a441] uppercase font-medium">
              Feudal Japan Action RPG
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wider text-[#f5f0e6] leading-none mt-1">
              SAMURAI
            </h1>
            <div className="font-display text-base sm:text-lg tracking-[0.22em] text-[#ef4444] mt-1">
              SHADOW OF THE SHOGUN
            </div>
          </div>
        </div>

        <p className="text-sm text-[#d6cfc2] leading-relaxed mb-8 max-w-md">
          Roam Kurokawa Village, Whispering Bamboo Grove, Kiyomizu Temple, and Kurogane Mountain Path.
          Master parries and katana combos to break Kuroda’s rebellion.
        </p>

        <div className="flex flex-col gap-2.5 w-64">
          {hasSave && (
            <button
              onClick={onContinue}
              className="py-3 px-5 rounded bg-[#b91c1c] hover:bg-[#dc2626] text-white font-display tracking-wider text-sm font-semibold border border-[#ef4444]/60 transition-colors cursor-pointer text-left flex items-center justify-between"
            >
              <span>Continue Journey</span>
              <span className="text-xs text-[#fef3c7]">→</span>
            </button>
          )}

          <button
            onClick={onNewGame}
            className={`py-3 px-5 rounded font-display tracking-wider text-sm font-semibold border transition-colors cursor-pointer text-left flex items-center justify-between ${
              hasSave
                ? 'border-[#d4a441]/50 text-[#f5f0e6] hover:bg-white/10'
                : 'bg-[#b91c1c] hover:bg-[#dc2626] text-white border-[#ef4444]/60'
            }`}
          >
            <span>New Game</span>
            <span className="text-xs text-[#d4a441]">Enter</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="py-2.5 px-5 rounded border border-white/15 text-[#e5e0d5] hover:bg-white/10 text-sm transition-colors cursor-pointer text-left"
          >
            Settings & Graphics
          </button>

          <button
            onClick={onOpenCredits}
            className="py-2.5 px-5 rounded border border-white/15 text-[#c7bfa8] hover:bg-white/10 text-sm transition-colors cursor-pointer text-left"
          >
            Credits
          </button>
        </div>
      </div>

      <div className="text-xs text-[#bfb8a8] tracking-wide">
        WASD Move · Mouse Look · Left Click Strike · Right Click Block · Q Dodge · E Interact · Esc Pause
      </div>
    </div>
  );
};

interface PauseModalProps {
  missions: Mission[];
  activeMissionId: string | null;
  onSelectMission: (id: string) => void;
  onResume: () => void;
  onSave: () => void;
  onOpenSettings: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  missions,
  activeMissionId,
  onSelectMission,
  onResume,
  onSave,
  onOpenSettings,
  onRestart,
  onMainMenu,
}) => {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-4" style={{ background: 'rgba(6, 6, 8, 0.78)' }}>
      <div
        className="w-full max-w-3xl rounded border border-[#d4a441]/40 p-6 grid grid-cols-1 md:grid-cols-12 gap-6 shadow-2xl"
        style={{ background: 'rgba(11, 10, 13, 0.96)' }}
      >
        <div className="md:col-span-5 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-2xl text-[#f5f0e6] mb-1">Paused</h2>
            <p className="text-xs text-[#bfb8a8] mb-5">Samurai: Shadow of the Shogun</p>

            <div className="flex flex-col gap-2">
              <button
                onClick={onResume}
                className="py-2.5 px-4 rounded bg-[#b91c1c] hover:bg-[#dc2626] text-white text-sm font-medium cursor-pointer text-left"
              >
                Resume
              </button>
              <button
                onClick={onSave}
                className="py-2.5 px-4 rounded border border-[#d4a441]/40 hover:bg-white/5 text-[#f5f0e6] text-sm cursor-pointer text-left"
              >
                Save Progress
              </button>
              <button
                onClick={onOpenSettings}
                className="py-2.5 px-4 rounded border border-white/15 hover:bg-white/5 text-[#e5e0d5] text-sm cursor-pointer text-left"
              >
                Settings
              </button>
              <button
                onClick={onRestart}
                className="py-2.5 px-4 rounded border border-white/15 hover:bg-white/5 text-[#e5e0d5] text-sm cursor-pointer text-left"
              >
                Restart New Game
              </button>
              <button
                onClick={onMainMenu}
                className="py-2.5 px-4 rounded border border-white/15 hover:bg-white/5 text-[#bfb8a8] text-sm cursor-pointer text-left"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>

        {/* Mission Journal */}
        <div className="md:col-span-7 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 max-h-[65vh] overflow-y-auto">
          <h3 className="font-display text-sm tracking-wider text-[#d4a441] mb-3">
            Missions
          </h3>
          <div className="space-y-2.5">
            {missions.map((m) => {
              const isActive = m.id === activeMissionId;
              const isDone = m.status === 'completed';
              return (
                <button
                  key={m.id}
                  onClick={() => !isDone && onSelectMission(m.id)}
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    isDone
                      ? 'border-white/10 opacity-65 cursor-default'
                      : isActive
                      ? 'border-[#d4a441] bg-[#d4a441]/10 cursor-pointer'
                      : 'border-white/15 hover:bg-white/5 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#f5f0e6]">{m.title}</span>
                    <span
                      className={`text-[10px] font-mono-tabular ${
                        isDone ? 'text-[#86efac]' : isActive ? 'text-[#fbbf24]' : 'text-[#9ca3af]'
                      }`}
                    >
                      {isDone ? 'Completed' : isActive ? 'Tracked' : 'Track'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#bfb8a8] mt-1">{m.summary}</p>
                  <div className="text-[10px] text-[#d4a441] mt-1.5 font-mono-tabular">
                    Reward: {m.xpReward} XP · {m.goldReward} Gold
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
