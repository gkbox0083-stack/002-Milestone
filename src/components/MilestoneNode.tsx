import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTranslation } from '../i18n/useTranslation';
import { STATUS_COLORS } from '../types';
import type { MilestoneStatus } from '../types';

type MilestoneNodeData = {
  label: string;
  status: MilestoneStatus;
  color: string;
  progress: number;
  isSelected: boolean;
  isCritical: boolean;
  darkMode: boolean;
};

function MilestoneNodeComponent({ data }: NodeProps & { data: MilestoneNodeData }) {
  const { label, status, color, progress, isSelected, isCritical, darkMode } = data as MilestoneNodeData;
  const { t } = useTranslation();
  const statusColor = STATUS_COLORS[status];

  return (
    <div
      className={`relative rounded-xl shadow-lg transition-all ${
        isSelected ? 'ring-3 ring-blue-500 scale-105' : ''
      } ${isCritical ? 'ring-2 ring-red-400' : ''}`}
      style={{
        backgroundColor: darkMode ? '#1e293b' : '#ffffff',
        border: `2px solid ${color}`,
        minWidth: 160,
        maxWidth: 200,
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white" />

      {/* Color bar */}
      <div className="h-1.5 rounded-t-xl" style={{ backgroundColor: color }} />

      <div className="px-3 py-2">
        <div className={`text-sm font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {label}
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {t(`status.${status}`)}
          </span>
        </div>

        {/* Progress bar */}
        <div className={`mt-2 h-1.5 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, backgroundColor: color }}
          />
        </div>
        <div className={`text-[10px] mt-0.5 text-right ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          {progress}%
        </div>
      </div>
    </div>
  );
}

export default memo(MilestoneNodeComponent);
