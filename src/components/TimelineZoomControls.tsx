import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

interface TimelineZoomControlsProps {
  dayWidth: number;
  minDayWidth: number;
  maxDayWidth: number;
  defaultDayWidth: number;
  darkMode: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
}

export default function TimelineZoomControls({
  dayWidth,
  minDayWidth,
  maxDayWidth,
  defaultDayWidth,
  darkMode,
  onZoomIn,
  onZoomOut,
  onFitView,
}: TimelineZoomControlsProps) {
  const { t } = useTranslation();
  const percentage = Math.round((dayWidth / defaultDayWidth) * 100);

  const bg = darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300';
  const hoverBg = darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100';
  const textColor = darkMode ? 'text-gray-300' : 'text-gray-600';
  const disabledClass = 'opacity-30 cursor-not-allowed';

  return (
    <div className={`absolute bottom-4 right-4 z-20 flex flex-col items-center rounded-lg border shadow-lg ${bg}`}>
      <button
        onClick={onZoomIn}
        disabled={dayWidth >= maxDayWidth}
        className={`p-2 border-b ${darkMode ? 'border-gray-600' : 'border-gray-300'} ${textColor} ${
          dayWidth >= maxDayWidth ? disabledClass : hoverBg
        } rounded-t-lg transition-colors`}
        title={t('timeline.zoom_in')}
      >
        <ZoomIn size={16} />
      </button>
      <button
        onClick={onZoomOut}
        disabled={dayWidth <= minDayWidth}
        className={`p-2 border-b ${darkMode ? 'border-gray-600' : 'border-gray-300'} ${textColor} ${
          dayWidth <= minDayWidth ? disabledClass : hoverBg
        } transition-colors`}
        title={t('timeline.zoom_out')}
      >
        <ZoomOut size={16} />
      </button>
      <button
        onClick={onFitView}
        className={`p-2 ${textColor} ${hoverBg} rounded-b-lg transition-colors`}
        title={t('timeline.fit_view')}
      >
        <Maximize size={16} />
      </button>
      <div className={`text-[10px] font-medium tabular-nums pb-1.5 ${textColor}`}>
        {percentage}%
      </div>
    </div>
  );
}
