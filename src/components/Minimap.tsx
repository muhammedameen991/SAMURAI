import React from 'react';
import { MinimapMarker } from '../game/types';
import { REGION_CENTERS } from '../game/utils';

interface MinimapProps {
  playerPos: { x: number; z: number; yaw: number };
  markers: MinimapMarker[];
}

export const Minimap: React.FC<MinimapProps> = ({ playerPos, markers }) => {
  const size = 136;
  const half = size / 2;
  const scale = 0.42; // 1 world unit -> 0.42px (shows ~160m radius)

  const toMap = (wx: number, wz: number) => {
    const dx = (wx - playerPos.x) * scale;
    const dz = (wz - playerPos.z) * scale;
    return {
      x: half + dx,
      y: half + dz,
    };
  };

  const clampToEdge = (mx: number, my: number) => {
    const dx = mx - half;
    const dy = my - half;
    const dist = Math.hypot(dx, dy);
    const maxR = half - 8;
    if (dist <= maxR) return { x: mx, y: my, clamped: false };
    return {
      x: half + (dx / dist) * maxR,
      y: half + (dy / dist) * maxR,
      clamped: true,
    };
  };

  // Player heading angle in screen space (forward is -Z or +yaw)
  const headingDeg = (-playerPos.yaw * 180) / Math.PI + 180;

  return (
    <div
      className="relative rounded-full border border-[#d4a441]/50 overflow-hidden shadow-lg"
      style={{
        width: size,
        height: size,
        background: 'rgba(10, 10, 12, 0.88)',
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <clipPath id="minimap-clip">
            <circle cx={half} cy={half} r={half - 2} />
          </clipPath>
        </defs>

        <g clipPath="url(#minimap-clip)">
          {/* Compass grid rings */}
          <circle cx={half} cy={half} r={half * 0.45} fill="none" stroke="rgba(212,164,65,0.14)" strokeWidth="1" />
          <circle cx={half} cy={half} r={half * 0.85} fill="none" stroke="rgba(212,164,65,0.12)" strokeWidth="1" />

          {/* Region labels */}
          {Object.entries(REGION_CENTERS).map(([id, info]) => {
            const p = toMap(info.x, info.z);
            if (Math.hypot(p.x - half, p.y - half) > half + 20) return null;
            return (
              <circle
                key={id}
                cx={p.x}
                cy={p.y}
                r={info.radius * scale * 0.35}
                fill="rgba(212, 164, 65, 0.08)"
                stroke="rgba(212, 164, 65, 0.22)"
                strokeWidth="1"
              />
            );
          })}

          {/* Markers */}
          {markers.map((m, idx) => {
            const raw = toMap(m.x, m.z);
            if (m.type === 'mission') {
              const c = clampToEdge(raw.x, raw.y);
              return (
                <g key={`m-${idx}`}>
                  <circle cx={c.x} cy={c.y} r={4.5} fill="#fbbf24" stroke="#09090b" strokeWidth="1.5" />
                </g>
              );
            }
            if (Math.hypot(raw.x - half, raw.y - half) > half - 5) return null;

            const fill =
              m.type === 'boss'
                ? '#ef4444'
                : m.type === 'enemy'
                ? '#dc2626'
                : m.type === 'shrine'
                ? '#38bdf8'
                : '#a7f3d0';
            const r = m.type === 'boss' ? 4 : 2.6;
            return <circle key={`m-${idx}`} cx={raw.x} cy={raw.y} r={r} fill={fill} />;
          })}

          {/* Player arrow */}
          <g transform={`translate(${half}, ${half}) rotate(${headingDeg})`}>
            <polygon points="0,-6 4.5,5 0,2.5 -4.5,5" fill="#f5f0e6" stroke="#b91c1c" strokeWidth="1" />
          </g>
        </g>
      </svg>
      <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-mono-tabular text-[#d4a441]/80">
        N
      </span>
    </div>
  );
};
