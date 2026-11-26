import React from 'react';
import { QUALITY_PRESETS } from '../game/settings';
import { AtmosphereMode, GameSettings, QualityPreset } from '../game/types';

interface SettingsModalProps {
  settings: GameSettings;
  isLowEndDetected: boolean;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  isLowEndDetected,
  onChange,
  onClose,
}) => {
  const applyPreset = (preset: QualityPreset) => {
    onChange({
      ...settings,
      quality: preset,
      ...QUALITY_PRESETS[preset],
    });
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: 'rgba(6, 6, 8, 0.82)' }}>
      <div
        className="w-full max-w-xl rounded border border-[#d4a441]/40 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'rgba(12, 11, 14, 0.96)' }}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-5">
          <div>
            <h2 className="font-display text-xl text-[#f5f0e6]">Settings</h2>
            {isLowEndDetected && (
              <p className="text-xs text-[#d4a441] mt-0.5">
                Low graphics preset recommended for your hardware
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-white/15 hover:bg-white/10 text-[#f5f0e6] cursor-pointer"
          >
            Done
          </button>
        </div>

        {/* Graphics Quality Presets */}
        <div className="mb-5">
          <div className="text-xs font-medium text-[#d6cfc2] mb-2">Graphics Preset</div>
          <div className="grid grid-cols-3 gap-2">
            {(['low', 'medium', 'high'] as QualityPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => applyPreset(preset)}
                className={`py-2 px-3 text-xs font-medium rounded border capitalize transition-colors cursor-pointer ${
                  settings.quality === preset
                    ? 'bg-[#b91c1c] border-[#ef4444] text-white'
                    : 'border-white/15 text-[#d6cfc2] hover:bg-white/5'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders & Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 text-xs">
          <div>
            <div className="flex justify-between text-[#d6cfc2] mb-1">
              <span>Resolution Scale</span>
              <span className="font-mono-tabular">{Math.round(settings.resolutionScale * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.0}
              step={0.05}
              value={settings.resolutionScale}
              onChange={(e) => onChange({ ...settings, resolutionScale: Number(e.target.value) })}
              className="w-full accent-[#b91c1c]"
            />
          </div>

          <div>
            <div className="flex justify-between text-[#d6cfc2] mb-1">
              <span>Draw Distance</span>
              <span className="font-mono-tabular">{settings.drawDistance}m</span>
            </div>
            <input
              type="range"
              min={140}
              max={340}
              step={20}
              value={settings.drawDistance}
              onChange={(e) => onChange({ ...settings, drawDistance: Number(e.target.value) })}
              className="w-full accent-[#b91c1c]"
            />
          </div>

          <label className="flex items-center justify-between p-2.5 rounded border border-white/10 cursor-pointer">
            <span className="text-[#e5e0d5]">Dynamic Shadows</span>
            <input
              type="checkbox"
              checked={settings.shadows}
              onChange={(e) => onChange({ ...settings, shadows: e.target.checked })}
              className="accent-[#b91c1c]"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded border border-white/10 cursor-pointer">
            <span className="text-[#e5e0d5]">Ambient Petals & Clouds</span>
            <input
              type="checkbox"
              checked={settings.ambientEffects}
              onChange={(e) => onChange({ ...settings, ambientEffects: e.target.checked })}
              className="accent-[#b91c1c]"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded border border-white/10 cursor-pointer">
            <span className="text-[#e5e0d5]">Combat Sparks</span>
            <input
              type="checkbox"
              checked={settings.particleEffects}
              onChange={(e) => onChange({ ...settings, particleEffects: e.target.checked })}
              className="accent-[#b91c1c]"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded border border-white/10 cursor-pointer">
            <span className="text-[#e5e0d5]">Show FPS Counter</span>
            <input
              type="checkbox"
              checked={settings.showFps}
              onChange={(e) => onChange({ ...settings, showFps: e.target.checked })}
              className="accent-[#b91c1c]"
            />
          </label>
        </div>

        {/* Atmosphere Mode */}
        <div className="mb-5">
          <div className="text-xs font-medium text-[#d6cfc2] mb-2">Atmosphere Lighting</div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['dynamic', 'Dynamic Cycle'],
                ['sunset', 'Crimson Dusk'],
                ['night', 'Moonlit Night'],
              ] as [AtmosphereMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => onChange({ ...settings, atmosphere: mode })}
                className={`py-2 px-3 text-xs font-medium rounded border transition-colors cursor-pointer ${
                  settings.atmosphere === mode
                    ? 'bg-[#d4a441]/20 border-[#d4a441] text-[#fef3c7]'
                    : 'border-white/15 text-[#d6cfc2] hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Audio & Controls */}
        <div className="border-t border-white/10 pt-4 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[#f5f0e6]">Audio & Controls</span>
            <button
              onClick={() => onChange({ ...settings, muted: !settings.muted })}
              className={`px-3 py-1 rounded border text-xs cursor-pointer ${
                settings.muted
                  ? 'border-[#dc2626] text-[#fca5a5] bg-[#dc2626]/15'
                  : 'border-white/15 text-[#e5e0d5]'
              }`}
            >
              {settings.muted ? 'Audio Muted' : 'Audio Active'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-[#d6cfc2] mb-1">
                <span>Master Volume</span>
                <span className="font-mono-tabular">{Math.round(settings.masterVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.masterVolume}
                onChange={(e) => onChange({ ...settings, masterVolume: Number(e.target.value) })}
                className="w-full accent-[#d4a441]"
              />
            </div>

            <div>
              <div className="flex justify-between text-[#d6cfc2] mb-1">
                <span>Music & Wind</span>
                <span className="font-mono-tabular">{Math.round(settings.musicVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.musicVolume}
                onChange={(e) => onChange({ ...settings, musicVolume: Number(e.target.value) })}
                className="w-full accent-[#d4a441]"
              />
            </div>

            <div>
              <div className="flex justify-between text-[#d6cfc2] mb-1">
                <span>Combat & SFX</span>
                <span className="font-mono-tabular">{Math.round(settings.sfxVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.sfxVolume}
                onChange={(e) => onChange({ ...settings, sfxVolume: Number(e.target.value) })}
                className="w-full accent-[#d4a441]"
              />
            </div>

            <div>
              <div className="flex justify-between text-[#d6cfc2] mb-1">
                <span>Camera Sensitivity</span>
                <span className="font-mono-tabular">{settings.mouseSensitivity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0.4}
                max={2.0}
                step={0.1}
                value={settings.mouseSensitivity}
                onChange={(e) => onChange({ ...settings, mouseSensitivity: Number(e.target.value) })}
                className="w-full accent-[#d4a441]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
