import React, { useState } from 'react';
import { DemandDataPoint } from '../../types';

interface DemandLineChartProps {
  data?: DemandDataPoint[];
}

export const DemandLineChart: React.FC<DemandLineChartProps> = ({
  data = [],
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <div className="h-[155px] w-full rounded-2xl border border-[#EAE5DA] bg-[#FAF8F5] flex items-center justify-center text-xs font-semibold text-[#68756D]">
        Demand history will appear after the backend returns observations.
      </div>
    );
  }

  const width = 460;
  const height = 150;
  const padding = { top: 15, right: 15, bottom: 25, left: 30 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const maxY = Math.max(10, ...data.flatMap((d) => [d.lays, d.pringles, d.bingo, d.tooYumm])) + 5;
  const pointsCount = data.length;

  const getX = (index: number) => padding.left + (index / (pointsCount - 1)) * innerWidth;
  const getY = (val: number) => padding.top + innerHeight - (val / maxY) * innerHeight;

  // Generate smooth cubic bezier curve SVG path
  const createSmoothPath = (values: number[]) => {
    return values.reduce((path, val, idx) => {
      const x = getX(idx);
      const y = getY(val);
      if (idx === 0) return `M ${x} ${y}`;

      const prevX = getX(idx - 1);
      const prevY = getY(values[idx - 1]);
      const cp1X = prevX + (x - prevX) * 0.5;
      const cp1Y = prevY;
      const cp2X = prevX + (x - prevX) * 0.5;
      const cp2Y = y;

      return `${path} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${x} ${y}`;
    }, '');
  };

  const laysPath = createSmoothPath(data.map((d) => d.lays));
  const pringlesPath = createSmoothPath(data.map((d) => d.pringles));
  const bingoPath = createSmoothPath(data.map((d) => d.bingo));
  const tooYummPath = createSmoothPath(data.map((d) => d.tooYumm));

  return (
    <div className="w-full">
      {/* SVG Chart */}
      <div className="relative w-full h-[155px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
        >
          {/* Grid lines & Y labels */}
          {Array.from({ length: 5 }, (_, index) => Math.round(index * maxY / 4)).map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#EDE8DF"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="text-[10px] fill-[#8A968E] font-medium"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* X Axis Day Labels */}
          {data.map((d, i) => (
            <text
              key={d.day}
              x={getX(i)}
              y={height - 4}
              textAnchor="middle"
              className={`text-[11px] font-medium transition-colors ${
                hoveredIndex === i ? 'fill-[#19211D] font-bold' : 'fill-[#8A968E]'
              }`}
            >
              {d.day}
            </text>
          ))}

          {/* Smooth series lines */}
          <path
            d={tooYummPath}
            fill="none"
            stroke="#38BDF8"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          <path
            d={bingoPath}
            fill="none"
            stroke="#E59E44"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          <path
            d={pringlesPath}
            fill="none"
            stroke="#E06D67"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          <path
            d={laysPath}
            fill="none"
            stroke="#375B42"
            strokeWidth="3"
            strokeLinecap="round"
            className="transition-all duration-300 drop-shadow-xs"
          />

          {/* Interactive hover indicator */}
          {hoveredIndex !== null && (
            <g>
              <line
                x1={getX(hoveredIndex)}
                y1={padding.top}
                x2={getX(hoveredIndex)}
                y2={padding.top + innerHeight}
                stroke="#19211D"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.5"
              />
              <circle
                cx={getX(hoveredIndex)}
                cy={getY(data[hoveredIndex].lays)}
                r="4.5"
                fill="#375B42"
                stroke="#FFF"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Interactive touch targets */}
          {data.map((_, i) => (
            <rect
              key={i}
              x={getX(i) - 20}
              y={padding.top}
              width={40}
              height={innerHeight}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </svg>

        {/* Hover Tooltip */}
        {hoveredIndex !== null && (
          <div
            className="absolute top-1 bg-white/95 backdrop-blur-xs border border-[#E5E0D6] rounded-xl px-2.5 py-1.5 shadow-md pointer-events-none text-[11px] font-semibold text-[#19211D] z-20 transition-all -translate-x-1/2"
            style={{ left: `${(getX(hoveredIndex) / width) * 100}%` }}
          >
            <div className="flex items-center gap-3">
              <span className="text-[#375B42]">Lay's: {data[hoveredIndex].lays}</span>
              <span className="text-[#E06D67]">Pringles: {data[hoveredIndex].pringles}</span>
              <span className="text-[#E59E44]">Bingo: {data[hoveredIndex].bingo}</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend matching sample UI */}
      <div className="flex items-center justify-start gap-4 pt-2 text-[12px] font-medium text-[#4A554E]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#375B42]" />
          <span>Lay's</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E06D67]" />
          <span>Pringles</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E59E44]" />
          <span>Bingo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
          <span>Too Yumm</span>
        </div>
      </div>
    </div>
  );
};
