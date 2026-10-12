import React from 'react';

interface DonutChartProps {
  percentage: number;
  healthyCount: number;
  lowStockCount: number;
  overstockCount: number;
  size?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  percentage = 0,
  healthyCount,
  lowStockCount,
  overstockCount,
  size = 140,
}) => {
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = healthyCount + lowStockCount + overstockCount;
  const healthyRatio = total > 0 ? healthyCount / total : percentage / 100;
  const lowStockRatio = total > 0 ? lowStockCount / total : 0;
  const overstockRatio = total > 0 ? overstockCount / total : 0;

  const healthyOffset = circumference - healthyRatio * circumference;
  const lowStockOffset = circumference - lowStockRatio * circumference;
  const overstockOffset = circumference - overstockRatio * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#F1EDE5"
          strokeWidth={strokeWidth}
        />

        {/* Overstock Slice (Amber) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#E59E44"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={overstockOffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{ transform: `rotate(${(healthyRatio + lowStockRatio) * 360}deg)`, transformOrigin: 'center' }}
        />

        {/* Low Stock Slice (Coral) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#E06D67"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={lowStockOffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{ transform: `rotate(${healthyRatio * 360}deg)`, transformOrigin: 'center' }}
        />

        {/* Healthy Slice (Forest Green - dominant) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#375B42"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={healthyOffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Center Percentage Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-extrabold text-[#19211D] tracking-tight leading-none">
          {percentage}%
        </span>
        <span className="text-[11px] font-semibold text-[#68756D] mt-0.5">
          Healthy
        </span>
      </div>
    </div>
  );
};
