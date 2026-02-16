import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, ZoomIn, ZoomOut, Maximize2, CalendarDays } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { getEffectiveMilestone, buildDisplayList } from '../utils';
import type { Milestone, MilestoneStatus } from '../types';
import { MILESTONE_COLORS } from '../types';

// ── Inline Color Picker ──────────────────────────────────────────────

function ColorPicker({
  color,
  onChange,
  darkMode,
}: {
  color: string;
  onChange: (c: string) => void;
  darkMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className="w-7 h-7 rounded-full border-2 border-white shadow-sm flex-shrink-0"
        style={{ backgroundColor: color }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      />
      {open && (
        <div
          className={`absolute z-50 bottom-full mb-1 left-1/2 -translate-x-1/2 p-2 rounded-lg shadow-xl border grid grid-cols-5 gap-1.5 ${
            darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
          }`}
        >
          {MILESTONE_COLORS.map((c) => (
            <button
              key={c}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                c === color ? 'border-white ring-2 ring-blue-500' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
              onClick={(e) => {
                e.stopPropagation();
                onChange(c);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Simplified Timeline ──────────────────────────────────────────────

function SimplifiedTimeline({
  milestones,
  parentIds,
  allMilestones,
  selectedIds,
  darkMode,
  onSelect,
  onDoubleClick,
  t,
}: {
  milestones: Milestone[];
  parentIds: Set<string>;
  allMilestones: Milestone[];
  selectedIds: string[];
  darkMode: boolean;
  onSelect: (id: string) => void;
  onDoubleClick: (ms: Milestone) => void;
  t: (key: string) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showDates, setShowDates] = useState(false);
  const scrollFractionRef = useRef(0.5);

  // Ctrl+Wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const scrollCenter = el.scrollLeft + el.clientWidth / 2;
      scrollFractionRef.current = el.scrollWidth > 0 ? scrollCenter / el.scrollWidth : 0.5;
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoomLevel((prev) => Math.max(0.5, Math.min(4, prev + delta)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Restore scroll position after zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const newCenter = el.scrollWidth * scrollFractionRef.current;
      el.scrollLeft = newCenter - el.clientWidth / 2;
    });
  }, [zoomLevel]);

  if (milestones.length === 0) return null;

  // Compute date range from ALL milestones (effective)
  const allDates = milestones.flatMap((ms) => [
    new Date(ms.startDate + 'T00:00:00').getTime(),
    new Date(ms.endDate + 'T00:00:00').getTime(),
  ]);
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const padMs = 7 * 24 * 60 * 60 * 1000;
  const rangeStart = minDate - padMs;
  const rangeEnd = maxDate + padMs;
  const totalRange = rangeEnd - rangeStart;

  // Separate parents vs non-parents
  const parentMilestones = milestones.filter((ms) => parentIds.has(ms.id));
  const childAndIndependent = milestones.filter((ms) => !parentIds.has(ms.id));

  // Sort non-parents by startDate for alternating placement
  const sorted = [...childAndIndependent].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  // Layout constants
  const minWidth = 900;
  const basePxPerMs = Math.max(minWidth, milestones.length * 120) / totalRange;
  const baseSvgWidth = Math.max(minWidth, totalRange * basePxPerMs);
  const svgWidth = baseSvgWidth * zoomLevel;
  const svgHeight = 320;
  const axisY = Math.round(svgHeight * 0.6); // 192px
  const markerR = 8;
  const padding = 40;

  function dateToX(dateStr: string): number {
    const ts = new Date(dateStr + 'T00:00:00').getTime();
    return padding + ((ts - rangeStart) / totalRange) * (svgWidth - padding * 2);
  }

  // ── Collision avoidance: adaptive horizontal spread + lane assignment ──
  const CLUSTER_THRESHOLD = 2; // px - markers closer than this are "same position"
  const STEM_HEIGHTS = [45, 75, 105, 135, 165];
  const CHAR_WIDTH = 6.5; // estimated px per char at fontSize 11
  const LABEL_GAP = 12;

  // Step 1: Compute raw X and display titles
  const rawPositions = sorted.map((ms) => {
    const displayTitle = ms.title.length > 16 ? ms.title.slice(0, 15) + '…' : ms.title;
    return { ms, rawX: dateToX(ms.startDate), displayTitle };
  });

  // Step 2: Spread same-date clusters using adaptive spacing based on label widths
  const spreadPositions: { ms: Milestone; x: number; displayTitle: string }[] = [];
  let ci = 0;
  while (ci < rawPositions.length) {
    let cj = ci;
    while (cj < rawPositions.length && Math.abs(rawPositions[cj].rawX - rawPositions[ci].rawX) <= CLUSTER_THRESHOLD) {
      cj++;
    }
    const size = cj - ci;
    if (size === 1) {
      spreadPositions.push({ ms: rawPositions[ci].ms, x: rawPositions[ci].rawX, displayTitle: rawPositions[ci].displayTitle });
    } else {
      // Calculate max label width in this cluster to determine needed spacing
      const labelWidths = [];
      for (let k = ci; k < cj; k++) {
        labelWidths.push(rawPositions[k].displayTitle.length * CHAR_WIDTH);
      }
      // Spacing between consecutive markers: average of adjacent label half-widths + gap
      for (let k = 0; k < size; k++) {
        const prevHalf = k > 0 ? labelWidths[k - 1] / 2 : 0;
        const currHalf = labelWidths[k] / 2;
        const spreadPx = Math.max(prevHalf + currHalf + LABEL_GAP, 50);
        // Position each marker sequentially; center the group around rawX
        if (k === 0) {
          // First pass: place relative to each other, center later
          spreadPositions.push({ ms: rawPositions[ci + k].ms, x: 0, displayTitle: rawPositions[ci + k].displayTitle });
        } else {
          const prevX = spreadPositions[spreadPositions.length - 1].x;
          spreadPositions.push({ ms: rawPositions[ci + k].ms, x: prevX + spreadPx, displayTitle: rawPositions[ci + k].displayTitle });
        }
      }
      // Center the cluster around the original raw X
      const clusterStart = spreadPositions.length - size;
      const firstX = spreadPositions[clusterStart].x;
      const lastX = spreadPositions[spreadPositions.length - 1].x;
      const clusterCenter = (firstX + lastX) / 2;
      const rawCenter = rawPositions[ci].rawX;
      const shift = rawCenter - clusterCenter;
      for (let k = clusterStart; k < spreadPositions.length; k++) {
        spreadPositions[k].x += shift;
      }
    }
    ci = cj;
  }

  // Step 3: Lane-based vertical assignment on spread positions
  const laneRightEdges: number[] = STEM_HEIGHTS.map(() => -Infinity);

  const placements = spreadPositions.map(({ ms, x, displayTitle }) => {
    const labelHalfW = (displayTitle.length * CHAR_WIDTH) / 2;
    const leftEdge = x - labelHalfW;
    const rightEdge = x + labelHalfW;

    // Find first lane where this label doesn't overlap
    let lane = 0;
    for (let i = 0; i < STEM_HEIGHTS.length; i++) {
      if (leftEdge >= laneRightEdges[i] + LABEL_GAP) {
        lane = i;
        break;
      }
      if (i === STEM_HEIGHTS.length - 1) {
        // All lanes occupied - pick the one with the smallest right edge
        let minEdge = Infinity;
        for (let j = 0; j < laneRightEdges.length; j++) {
          if (laneRightEdges[j] < minEdge) {
            minEdge = laneRightEdges[j];
            lane = j;
          }
        }
      }
    }

    laneRightEdges[lane] = rightEdge;
    return { ms, x, stemLength: STEM_HEIGHTS[lane], displayTitle };
  });

  // Generate month ticks
  const ticks: { x: number; label: string }[] = [];
  const tickDate = new Date(rangeStart);
  tickDate.setDate(1);
  tickDate.setMonth(tickDate.getMonth() + 1);
  while (tickDate.getTime() <= rangeEnd) {
    const x = padding + ((tickDate.getTime() - rangeStart) / totalRange) * (svgWidth - padding * 2);
    ticks.push({
      x,
      label: tickDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    });
    tickDate.setMonth(tickDate.getMonth() + 1);
  }

  // Today marker
  const todayMs = Date.now();
  const todayInRange = todayMs >= rangeStart && todayMs <= rangeEnd;
  const todayX = todayInRange
    ? padding + ((todayMs - rangeStart) / totalRange) * (svgWidth - padding * 2)
    : 0;

  const textColor = darkMode ? '#d1d5db' : '#374151';
  const axisColor = darkMode ? '#4b5563' : '#d1d5db';
  const tickColor = darkMode ? '#9ca3af' : '#6b7280';
  const dateLabelColor = darkMode ? '#9ca3af' : '#6b7280';

  const handleZoomIn = () => {
    scrollFractionRef.current = containerRef.current
      ? (containerRef.current.scrollLeft + containerRef.current.clientWidth / 2) / containerRef.current.scrollWidth
      : 0.5;
    setZoomLevel((prev) => Math.min(4, prev + 0.25));
  };
  const handleZoomOut = () => {
    scrollFractionRef.current = containerRef.current
      ? (containerRef.current.scrollLeft + containerRef.current.clientWidth / 2) / containerRef.current.scrollWidth
      : 0.5;
    setZoomLevel((prev) => Math.max(0.5, prev - 0.25));
  };
  const handleFitView = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      setZoomLevel(Math.max(0.5, Math.min(4, containerWidth / baseSvgWidth)));
    }
  };

  const toolbarBg = darkMode
    ? 'bg-gray-800/90 border-gray-600 text-gray-300'
    : 'bg-white/90 border-gray-300 text-gray-600';
  const toolbarBtnHover = darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100';

  return (
    <div className={`relative flex-shrink-0 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
      <div
        ref={containerRef}
        className={`overflow-x-auto ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50/50'}`}
        style={{ height: 320 }}
      >
        <svg width={svgWidth} height={svgHeight}>
          {/* Axis line */}
          <line
            x1={padding}
            y1={axisY}
            x2={svgWidth - padding}
            y2={axisY}
            stroke={axisColor}
            strokeWidth={2}
          />

          {/* Month ticks */}
          {ticks.map((tick, i) => (
            <g key={i}>
              <line
                x1={tick.x}
                y1={axisY - 6}
                x2={tick.x}
                y2={axisY + 6}
                stroke={tickColor}
                strokeWidth={1.5}
              />
              <text
                x={tick.x}
                y={axisY + 50}
                textAnchor="middle"
                fill={tickColor}
                fontSize={11}
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Today marker */}
          {todayInRange && (
            <g>
              <line
                x1={todayX}
                y1={10}
                x2={todayX}
                y2={svgHeight - 10}
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="6 3"
              />
              <text
                x={todayX}
                y={svgHeight - 2}
                textAnchor="middle"
                fill="#ef4444"
                fontSize={10}
                fontWeight="bold"
              >
                {t('table.today')}
              </text>
            </g>
          )}

          {/* Parent group range bars (below axis) */}
          {parentMilestones.map((ms) => {
            const x1 = dateToX(ms.startDate);
            const x2 = dateToX(ms.endDate);
            const barWidth = Math.max(x2 - x1, 20);
            const barY = axisY + 8;
            const barH = 22;
            const isSelected = selectedIds.includes(ms.id);

            return (
              <g
                key={ms.id}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(ms.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDoubleClick(ms);
                }}
              >
                {/* Range bar */}
                <rect
                  x={x1}
                  y={barY}
                  width={barWidth}
                  height={barH}
                  rx={6}
                  fill={ms.color}
                  fillOpacity={0.25}
                  stroke={ms.color}
                  strokeOpacity={0.6}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                {isSelected && (
                  <rect
                    x={x1 - 1}
                    y={barY - 1}
                    width={barWidth + 2}
                    height={barH + 2}
                    rx={7}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                )}
                {/* Title centered in bar */}
                <text
                  x={x1 + barWidth / 2}
                  y={barY + barH / 2 + 4}
                  textAnchor="middle"
                  fill={ms.color}
                  fontSize={11}
                  fontWeight="600"
                >
                  {ms.title.length > Math.floor(barWidth / 7)
                    ? ms.title.slice(0, Math.floor(barWidth / 7) - 1) + '…'
                    : ms.title}
                </text>
              </g>
            );
          })}

          {/* Child + independent milestone markers (above axis, lane-based) */}
          {placements.map(({ ms, x, stemLength, displayTitle }) => {
            const stemEnd = axisY - stemLength;
            const titleY = showDates ? stemEnd - markerR - 18 : stemEnd - markerR - 6;
            const dateY = stemEnd - markerR - 4;
            const isSelected = selectedIds.includes(ms.id);

            // Format date as MM/DD
            const d = new Date(ms.startDate + 'T00:00:00');
            const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

            return (
              <g
                key={ms.id}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(ms.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDoubleClick(ms);
                }}
              >
                {/* Stem line */}
                <line
                  x1={x}
                  y1={axisY}
                  x2={x}
                  y2={stemEnd}
                  stroke={ms.color}
                  strokeWidth={2}
                />
                {/* Circle marker */}
                <circle
                  cx={x}
                  cy={stemEnd}
                  r={markerR}
                  fill={ms.color}
                  stroke={isSelected ? '#3b82f6' : darkMode ? '#1f2937' : '#ffffff'}
                  strokeWidth={isSelected ? 3 : 2}
                />
                {/* Title label */}
                <text
                  x={x}
                  y={titleY}
                  textAnchor="middle"
                  fill={textColor}
                  fontSize={11}
                  fontWeight={isSelected ? 'bold' : 'normal'}
                >
                  {displayTitle}
                </text>
                {/* Date label (optional) */}
                {showDates && (
                  <text
                    x={x}
                    y={dateY}
                    textAnchor="middle"
                    fill={dateLabelColor}
                    fontSize={9}
                  >
                    {dateStr}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Zoom & date toolbar */}
      <div className={`absolute bottom-2 right-2 z-20 flex items-center gap-0.5 rounded-lg border px-1 py-0.5 backdrop-blur-sm ${toolbarBg}`}>
        <button
          onClick={handleZoomOut}
          className={`p-1.5 rounded ${toolbarBtnHover} transition-colors`}
          title={t('timeline.zoom_out')}
        >
          <ZoomOut size={14} />
        </button>
        <span className={`text-xs px-1 min-w-[36px] text-center select-none ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className={`p-1.5 rounded ${toolbarBtnHover} transition-colors`}
          title={t('timeline.zoom_in')}
        >
          <ZoomIn size={14} />
        </button>
        <div className={`w-px h-4 mx-0.5 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
        <button
          onClick={handleFitView}
          className={`p-1.5 rounded ${toolbarBtnHover} transition-colors`}
          title={t('timeline.fit_view')}
        >
          <Maximize2 size={14} />
        </button>
        <div className={`w-px h-4 mx-0.5 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
        <button
          onClick={() => setShowDates((v) => !v)}
          className={`p-1.5 rounded transition-colors ${
            showDates
              ? darkMode
                ? 'bg-blue-900/50 text-blue-400'
                : 'bg-blue-100 text-blue-600'
              : toolbarBtnHover
          }`}
          title={showDates ? t('table.hide_dates') : t('table.show_dates')}
        >
          <CalendarDays size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Table View Component ─────────────────────────────────────────────

const STATUS_OPTIONS: MilestoneStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'at_risk',
  'blocked',
];

export default function TableView() {
  const {
    project,
    selectedMilestoneIds,
    darkMode,
    collapsedGroupIds,
    selectMilestone,
    setEditingMilestone,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    toggleGroupCollapse,
  } = useStore();
  const { t } = useTranslation();

  const milestones = project.milestones;

  // Compute effective milestones (parents get aggregated values)
  const effectiveMilestones = useMemo(
    () => milestones.map((ms) => getEffectiveMilestone(milestones, ms)),
    [milestones],
  );

  // Set of parent IDs (milestones that have children)
  const parentIds = useMemo(() => {
    const set = new Set<string>();
    for (const ms of milestones) {
      if (ms.parentId) set.add(ms.parentId);
    }
    return set;
  }, [milestones]);

  // Build display list using buildDisplayList for ordered parent/child grouping
  const displayRows = useMemo(
    () => buildDisplayList(milestones, collapsedGroupIds),
    [milestones, collapsedGroupIds],
  );

  // Map from child milestone ID to parent's color
  const parentColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ms of milestones) {
      if (ms.parentId) {
        const parent = milestones.find((m) => m.id === ms.parentId);
        if (parent) map.set(ms.id, parent.color);
      }
    }
    return map;
  }, [milestones]);

  const handleAdd = () => {
    const ms = addMilestone();
    setEditingMilestone(ms);
  };

  const isReadOnly = useCallback(
    (ms: Milestone, field: string) => {
      if (!parentIds.has(ms.id)) return false;
      return ['startDate', 'endDate', 'progress', 'status'].includes(field);
    },
    [parentIds],
  );

  // Style classes
  const headerBg = darkMode ? 'bg-gray-800' : 'bg-gray-100';
  const rowBg = darkMode ? 'bg-gray-900' : 'bg-white';
  const rowHoverBg = darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50';
  const selectedBg = darkMode ? 'bg-blue-900/30' : 'bg-blue-50';
  const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
  const inputBg = darkMode
    ? 'bg-gray-800 text-gray-200 border-gray-600'
    : 'bg-white text-gray-900 border-gray-300';
  const textMuted = darkMode ? 'text-gray-400' : 'text-gray-500';

  if (milestones.length === 0) {
    return (
      <div className={`h-full flex flex-col items-center justify-center gap-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <p className="text-lg">{t('table.empty')}</p>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus size={16} />
          {t('table.add_row')}
        </button>
      </div>
    );
  }

  // Row numbering: skip parent rows, sequential for children + independent
  let rowCounter = 0;

  return (
    <div className="h-full flex flex-col">
      {/* Simplified Timeline */}
      <SimplifiedTimeline
        milestones={effectiveMilestones}
        parentIds={parentIds}
        allMilestones={milestones}
        selectedIds={selectedMilestoneIds}
        darkMode={darkMode}
        onSelect={selectMilestone}
        onDoubleClick={setEditingMilestone}
        t={t}
      />

      {/* Editable Table */}
      <div className="flex-1 overflow-auto">
        <table className={`w-full border-collapse text-sm ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
          <thead className={`${headerBg} sticky top-0 z-10`}>
            <tr>
              <th className={`px-3 py-2.5 text-left font-semibold border-b ${borderColor} w-10`}>#</th>
              <th className={`px-3 py-2.5 text-left font-semibold border-b ${borderColor} min-w-[160px]`}>
                {t('table.col_title')}
              </th>
              <th className={`px-3 py-2.5 text-left font-semibold border-b ${borderColor} w-[130px]`}>
                {t('table.col_start')}
              </th>
              <th className={`px-3 py-2.5 text-left font-semibold border-b ${borderColor} w-[130px]`}>
                {t('table.col_end')}
              </th>
              <th className={`px-3 py-2.5 text-left font-semibold border-b ${borderColor} w-[120px]`}>
                {t('table.col_status')}
              </th>
              <th className={`px-3 py-2.5 text-left font-semibold border-b ${borderColor} w-[120px]`}>
                {t('table.col_progress')}
              </th>
              <th className={`px-3 py-2.5 text-center font-semibold border-b ${borderColor} w-[60px]`}>
                {t('table.col_color')}
              </th>
              <th className={`px-3 py-2.5 text-left font-semibold border-b ${borderColor}`}>
                {t('table.col_description')}
              </th>
              <th className={`px-3 py-2.5 text-center font-semibold border-b ${borderColor} w-[50px]`} />
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const ms = row.milestone;
              const rawMs = milestones.find((m) => m.id === ms.id) || ms;
              const isSelected = selectedMilestoneIds.includes(ms.id);

              // ── Parent group row (section header) ──
              if (row.isParent) {
                return (
                  <tr
                    key={ms.id}
                    className={`${isSelected ? selectedBg : ''} ${rowHoverBg} transition-colors cursor-pointer`}
                    style={{
                      borderLeft: `3px solid ${ms.color}`,
                      backgroundColor: isSelected
                        ? undefined
                        : `${ms.color}${darkMode ? '14' : '14'}`,
                    }}
                    onClick={() => selectMilestone(ms.id)}
                    onDoubleClick={() => setEditingMilestone(rawMs)}
                  >
                    {/* Collapse toggle instead of row number */}
                    <td className={`px-3 py-2 border-b ${borderColor}`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroupCollapse(ms.id);
                        }}
                        className={`p-0.5 rounded transition-colors ${
                          darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                        }`}
                        title={row.isCollapsed ? t('table.expand') : t('table.collapse')}
                      >
                        {row.isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>

                    {/* Title - bold with larger color dot */}
                    <td className={`px-3 py-2 border-b ${borderColor}`}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: ms.color }}
                        />
                        <input
                          type="text"
                          value={ms.title}
                          onChange={(e) => updateMilestone(ms.id, { title: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className={`w-full px-1.5 py-0.5 rounded border text-sm font-semibold ${inputBg}`}
                        />
                      </div>
                    </td>

                    {/* Start Date - read-only text */}
                    <td className={`px-3 py-2 border-b ${borderColor} ${textMuted} text-xs`}>
                      {ms.startDate}
                    </td>

                    {/* End Date - read-only text */}
                    <td className={`px-3 py-2 border-b ${borderColor} ${textMuted} text-xs`}>
                      {ms.endDate}
                    </td>

                    {/* Status - read-only text */}
                    <td className={`px-3 py-2 border-b ${borderColor} ${textMuted} text-xs`}>
                      {t(`status.${ms.status}`)}
                    </td>

                    {/* Progress - read-only text */}
                    <td className={`px-3 py-2 border-b ${borderColor} ${textMuted} text-xs`}>
                      {ms.progress}%
                    </td>

                    {/* Color */}
                    <td className={`px-3 py-2 border-b ${borderColor}`}>
                      <div
                        className="flex justify-center"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <ColorPicker
                          color={ms.color}
                          onChange={(c) => updateMilestone(ms.id, { color: c })}
                          darkMode={darkMode}
                        />
                      </div>
                    </td>

                    {/* Description - read-only text */}
                    <td className={`px-3 py-2 border-b ${borderColor} ${textMuted} text-xs truncate max-w-[200px]`}>
                      {ms.description || '—'}
                    </td>

                    {/* Delete */}
                    <td className={`px-3 py-2 border-b ${borderColor}`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMilestone(ms.id);
                        }}
                        className={`p-1 rounded transition-colors ${
                          darkMode ? 'hover:bg-red-900/50 text-gray-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'
                        }`}
                        title={t('table.delete_tooltip')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              }

              // ── Child row or independent row ──
              rowCounter++;
              const parentColor = parentColorMap.get(ms.id);
              const isChild = row.indent === 1;

              return (
                <tr
                  key={ms.id}
                  className={`${isSelected ? selectedBg : rowBg} ${rowHoverBg} transition-colors cursor-pointer`}
                  style={isChild && parentColor ? { borderLeft: `2px solid ${parentColor}` } : undefined}
                  onClick={() => selectMilestone(ms.id)}
                  onDoubleClick={() => setEditingMilestone(rawMs)}
                >
                  {/* Row number */}
                  <td className={`px-3 py-1.5 border-b ${borderColor} ${textMuted}`}>
                    <span className={isChild ? 'pl-4' : ''}>{rowCounter}</span>
                  </td>

                  {/* Title */}
                  <td className={`px-3 py-1.5 border-b ${borderColor}`}>
                    <div className={`flex items-center gap-1.5 ${isChild ? 'pl-4' : ''}`}>
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ms.color }}
                      />
                      <input
                        type="text"
                        value={ms.title}
                        onChange={(e) => updateMilestone(ms.id, { title: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className={`w-full px-1.5 py-0.5 rounded border text-sm ${inputBg}`}
                      />
                    </div>
                  </td>

                  {/* Start Date */}
                  <td className={`px-3 py-1.5 border-b ${borderColor}`}>
                    <input
                      type="date"
                      value={ms.startDate}
                      onChange={(e) => updateMilestone(ms.id, { startDate: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className={`w-full px-1.5 py-0.5 rounded border text-sm ${inputBg}`}
                    />
                  </td>

                  {/* End Date */}
                  <td className={`px-3 py-1.5 border-b ${borderColor}`}>
                    <input
                      type="date"
                      value={ms.endDate}
                      onChange={(e) => updateMilestone(ms.id, { endDate: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className={`w-full px-1.5 py-0.5 rounded border text-sm ${inputBg}`}
                    />
                  </td>

                  {/* Status */}
                  <td className={`px-3 py-1.5 border-b ${borderColor}`}>
                    <select
                      value={ms.status}
                      onChange={(e) =>
                        updateMilestone(ms.id, { status: e.target.value as MilestoneStatus })
                      }
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className={`w-full px-1.5 py-0.5 rounded border text-sm ${inputBg}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {t(`status.${s}`)}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Progress */}
                  <td className={`px-3 py-1.5 border-b ${borderColor}`}>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={ms.progress}
                        onChange={(e) =>
                          updateMilestone(ms.id, { progress: parseInt(e.target.value) })
                        }
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="flex-1 h-1.5"
                      />
                      <span className={`text-xs w-8 text-right ${textMuted}`}>{ms.progress}%</span>
                    </div>
                  </td>

                  {/* Color */}
                  <td className={`px-3 py-1.5 border-b ${borderColor}`}>
                    <div
                      className="flex justify-center"
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                      <ColorPicker
                        color={ms.color}
                        onChange={(c) => updateMilestone(ms.id, { color: c })}
                        darkMode={darkMode}
                      />
                    </div>
                  </td>

                  {/* Description */}
                  <td className={`px-3 py-1.5 border-b ${borderColor}`}>
                    <input
                      type="text"
                      value={ms.description}
                      onChange={(e) => updateMilestone(ms.id, { description: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      placeholder="..."
                      className={`w-full px-1.5 py-0.5 rounded border text-sm ${inputBg}`}
                    />
                  </td>

                  {/* Delete */}
                  <td className={`px-3 py-1.5 border-b ${borderColor}`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMilestone(ms.id);
                      }}
                      className={`p-1 rounded transition-colors ${
                        darkMode ? 'hover:bg-red-900/50 text-gray-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'
                      }`}
                      title={t('table.delete_tooltip')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add Milestone button */}
        <div className={`p-3 border-t ${borderColor}`}>
          <button
            onClick={handleAdd}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              darkMode
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Plus size={14} />
            {t('table.add_row')}
          </button>
        </div>
      </div>
    </div>
  );
}
