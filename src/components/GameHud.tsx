import React from 'react';
import { HudSnapshot } from '../game/types';
import { Minimap } from './Minimap';

interface GameHudProps {
  hud: HudSnapshot;
  showFps: boolean;
  onCloseDialogue: () => void;
  onDialogueAction: (actionId?: string) => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  showFps,
  onCloseDialogue,
  onDialogueAction,
}) => {
  const hpPct = Math.max(0, Math.min(100, (hud.health / Math.max(1, hud.maxHealth)) * 100));
  const stamPct = Math.max(0, Math.min(100, (hud.stamina / Math.max(1, hud.maxStamina)) * 100));
  const xpPct = Math.max(0, Math.min(100, (hud.xp / Math.max(1, hud.xpToNext)) * 100));

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
      {/* Top Row: Player Vitals (Left) | Mission & Target (Center) | Minimap & Region (Right) */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left Vitals Cluster */}
        <div
          className="w-64 rounded border border-[#d4a441]/25 px-3.5 py-3"
          style={{ background: 'rgba(10, 10, 12, 0.84)' }}
        >
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="font-display text-xs tracking-wider text-[#f5f0e6]">
              Level {hud.level} Samurai
            </span>
            <span className="font-mono-tabular text-[11px] text-[#d4a441]">
              {hud.gold} Gold
            </span>
          </div>

          {/* Health Bar */}
          <div className="mb-1.5">
            <div className="flex justify-between text-[11px] text-[#d6cfc2] mb-0.5 font-mono-tabular">
              <span>Health</span>
              <span>
                {hud.health}/{hud.maxHealth}
              </span>
            </div>
            <div className="h-2 w-full bg-[#1c1917] rounded-sm overflow-hidden border border-white/10">
              <div
                className="h-full bg-[#dc2626] transition-[width] duration-150"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {/* Stamina Bar */}
          <div className="mb-1.5">
            <div className="flex justify-between text-[10px] text-[#c7bfa8] mb-0.5 font-mono-tabular">
              <span>Stamina</span>
              <span>{hud.stamina}</span>
            </div>
            <div className="h-1.5 w-full bg-[#1c1917] rounded-sm overflow-hidden">
              <div
                className="h-full bg-[#d4a441] transition-[width] duration-75"
                style={{ width: `${stamPct}%` }}
              />
            </div>
          </div>

          {/* XP Bar */}
          <div className="mb-2">
            <div className="h-1 w-full bg-[#1c1917] rounded-sm overflow-hidden">
              <div
                className="h-full bg-[#e5e0d5]"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#bfb8a8] border-t border-white/10 pt-1.5">
            <span className="truncate max-w-[140px]">{hud.katanaName}</span>
            <span className="font-mono-tabular text-[#6ee7b7]">
              [R] Elixir x{hud.healingCharges}
            </span>
          </div>
        </div>

        {/* Top-Center Mission & Targeted Enemy */}
        <div className="flex flex-col items-center gap-2.5 max-w-md w-full">
          {hud.activeMission && (
            <div
              className="px-4 py-2.5 rounded border border-[#d4a441]/30 text-center w-full max-w-sm"
              style={{ background: 'rgba(10, 10, 12, 0.82)' }}
            >
              <div className="text-[11px] text-[#d4a441] font-medium tracking-wide">
                Mission {hud.completedMissionsCount + 1} of {hud.totalMissionsCount} · {hud.activeMission.title}
              </div>
              {hud.activeMission.objectives.map((obj) => (
                <div
                  key={obj.id}
                  className={`text-xs mt-0.5 font-mono-tabular ${
                    obj.completed ? 'text-[#86efac] line-through' : 'text-[#f5f0e6]'
                  }`}
                >
                  {obj.description} ({obj.current}/{obj.target})
                </div>
              ))}
            </div>
          )}

          {hud.targetEnemy && (
            <div
              className="px-4 py-2 rounded border border-[#dc2626]/45 w-72"
              style={{ background: 'rgba(14, 9, 10, 0.88)' }}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-display text-[#f5f0e6] truncate">
                  {hud.targetEnemy.name}
                </span>
                <span className="font-mono-tabular text-[11px] text-[#fca5a5]">
                  {hud.targetEnemy.isBlocking ? 'Guarding' : `${hud.targetEnemy.health}/${hud.targetEnemy.maxHealth}`}
                </span>
              </div>
              <div className="h-2 w-full bg-[#1c1917] rounded-sm overflow-hidden border border-white/10">
                <div
                  className="h-full bg-[#ef4444] transition-[width] duration-100"
                  style={{
                    width: `${Math.max(
                      0,
                      (hud.targetEnemy.health / Math.max(1, hud.targetEnemy.maxHealth)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Top-Right Minimap & Region */}
        <div className="flex flex-col items-end gap-1.5">
          <Minimap playerPos={hud.playerPos} markers={hud.minimapMarkers} />
          <div
            className="px-2.5 py-1 rounded border border-white/10 text-right"
            style={{ background: 'rgba(10, 10, 12, 0.82)' }}
          >
            <div className="text-xs font-medium text-[#f5f0e6]">{hud.regionName}</div>
            <div className="text-[10px] text-[#bfb8a8] font-mono-tabular">
              {hud.timeOfDayLabel}
              {showFps ? ` · ${hud.fps} FPS` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Center Toast Notification */}
      {hud.toastMessage && !hud.dialogue && (
        <div className="self-center animate-fade-slide-up">
          <div
            className={`px-6 py-3 rounded border text-center ${
              hud.toastMessage.tone === 'gold'
                ? 'border-[#d4a441]/60'
                : hud.toastMessage.tone === 'crimson'
                ? 'border-[#dc2626]/60'
                : 'border-white/20'
            }`}
            style={{ background: 'rgba(10, 10, 12, 0.9)' }}
          >
            <div className="font-display text-sm tracking-wide text-[#f5f0e6]">
              {hud.toastMessage.title}
            </div>
            <div className="text-xs text-[#d6cfc2] mt-0.5">{hud.toastMessage.subtitle}</div>
          </div>
        </div>
      )}

      {/* Dialogue Modal */}
      {hud.dialogue && (
        <div className="self-center w-full max-w-xl pointer-events-auto animate-fade-slide-up">
          <div
            className="rounded border border-[#d4a441]/50 p-5 shadow-2xl"
            style={{ background: 'rgba(10, 10, 12, 0.95)' }}
          >
            <div className="flex items-baseline justify-between border-b border-white/10 pb-2 mb-3">
              <div>
                <h3 className="font-display text-lg text-[#f5f0e6]">{hud.dialogue.speaker}</h3>
                <p className="text-xs text-[#d4a441]">{hud.dialogue.role}</p>
              </div>
              <span className="text-xs text-[#9ca3af] font-mono-tabular">ESC to close</span>
            </div>
            <div className="space-y-2 text-sm text-[#e5e0d5] leading-relaxed mb-4">
              {hud.dialogue.lines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3">
              {hud.dialogue.actionLabel && (
                <button
                  onClick={() => onDialogueAction(hud.dialogue?.actionId)}
                  className="px-4 py-2 text-xs font-semibold rounded bg-[#b91c1c] hover:bg-[#dc2626] text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  {hud.dialogue.actionLabel}
                </button>
              )}
              <button
                onClick={onCloseDialogue}
                className="px-4 py-2 text-xs font-medium rounded border border-[#d4a441]/40 text-[#f5f0e6] hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Row: Interaction Prompt & Controls Bar */}
      <div className="flex flex-col items-center gap-2">
        {hud.interactPrompt && !hud.dialogue && (
          <div
            className="px-4 py-2 rounded border border-[#d4a441]/55 text-center animate-fade-slide-up"
            style={{ background: 'rgba(10, 10, 12, 0.9)' }}
          >
            <span className="text-xs font-semibold text-[#fbbf24] mr-2">[E]</span>
            <span className="text-xs font-medium text-[#f5f0e6]">{hud.interactPrompt.label}</span>
            {hud.interactPrompt.sublabel && (
              <span className="text-[11px] text-[#bfb8a8] ml-2">· {hud.interactPrompt.sublabel}</span>
            )}
          </div>
        )}

        <div
          className="px-4 py-1.5 rounded border border-white/10 text-[11px] text-[#c7bfa8] tracking-wide"
          style={{ background: 'rgba(10, 10, 12, 0.78)' }}
        >
          WASD Move · Shift Sprint · Space Jump · Q Dodge · LMB / J Strike · Shift+LMB / K Heavy · RMB / F Block · E Interact · Esc Pause
          {!hud.pointerLocked && ' · Click game view to lock mouse'}
        </div>
      </div>
    </div>
  );
};
