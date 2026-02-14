import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import type { Milestone } from '../types';
import { formatDate, getDaysBetween, findCriticalPath, buildDisplayList, getEffectiveMilestone } from '../utils';
import TimelineZoomControls from './TimelineZoomControls';

const ROW_HEIGHT = 52;
const HEADER_HEIGHT = 60;
const LEFT_PANEL_WIDTH = 220;
const DAY_WIDTH_MIN = 16;
const DAY_WIDTH_MAX = 120;
const DAY_WIDTH_DEFAULT = 32;
const INDENT_PX = 24;

export default function TimelineView() {
  const { project, selectedMilestoneId, selectedMilestoneIds, selectMilestone, selectMilestones, toggleMilestoneSelection, clearSelection, setEditingMilestone, updateMilestone, darkMode, collapsedGroupIds, toggleGroupCollapse, reorderMilestone } = useStore();
  const { t, language } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const barsAreaRef = useRef<HTMLDivElement>(null);
  const [dayWidth, setDayWidth] = useState(DAY_WIDTH_DEFAULT);
  const [, setScrollLeft] = useState(0);
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    type: 'move' | 'resize-end';
    startX: number;
    origStart: string;
    origEnd: string;
  } | null>(null);

  // Row drag-to-reorder state
  const [rowDragId, setRowDragId] = useState<string | null>(null);
  const [dropLine, setDropLine] = useState<{ idx: number; position: 'before' | 'after' } | null>(null);
  const dropTargetRef = useRef<{ targetId: string; position: 'before' | 'after' } | null>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  // Canvas pan state (middle mouse drag)
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const milestones = project.milestones;
  const criticalPath = useMemo(() => findCriticalPath(milestones), [milestones]);
  const locale = language === 'zh-TW' ? 'zh-TW' : 'en-US';

  // Build display rows with parent-child grouping
  const displayRows = useMemo(
    () => buildDisplayList(milestones, collapsedGroupIds),
    [milestones, collapsedGroupIds],
  );

  // Map milestone id -> display row index for dependency arrows
  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    displayRows.forEach((row, idx) => map.set(row.milestone.id, idx));
    return map;
  }, [displayRows]);

  // Set of visible milestone ids
  const visibleIds = useMemo(
    () => new Set(displayRows.map((r) => r.milestone.id)),
    [displayRows],
  );

  // Compute date range from effective milestones (parents use aggregated dates)
  const { minDate, totalDays } = useMemo(() => {
    if (milestones.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      return { minDate: today, totalDays: 60 };
    }
    const effectiveMilestones = milestones.map((m) => getEffectiveMilestone(milestones, m));
    const dates = effectiveMilestones.flatMap((m) => [m.startDate, m.endDate]);
    const sorted = dates.sort();
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const padding = 14;
    const minD = new Date(min);
    minD.setDate(minD.getDate() - padding);
    const maxD = new Date(max);
    maxD.setDate(maxD.getDate() + padding);
    const minStr = minD.toISOString().split('T')[0];
    const maxStr = maxD.toISOString().split('T')[0];
    return {
      minDate: minStr,
      totalDays: getDaysBetween(minStr, maxStr),
    };
  }, [milestones]);

  // Zoom with Ctrl+Wheel, horizontal scroll with Shift+Wheel
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setDayWidth((prev) =>
          Math.min(DAY_WIDTH_MAX, Math.max(DAY_WIDTH_MIN, prev - e.deltaY * 0.1)),
        );
      } else if (e.shiftKey) {
        e.preventDefault();
        if (containerRef.current) {
          containerRef.current.scrollLeft += e.deltaY;
        }
      }
    },
    [],
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft((e.target as HTMLDivElement).scrollLeft);
  }, []);

  const handleZoomIn = useCallback(() => {
    setDayWidth((prev) => Math.min(DAY_WIDTH_MAX, prev + 8));
  }, []);

  const handleZoomOut = useCallback(() => {
    setDayWidth((prev) => Math.max(DAY_WIDTH_MIN, prev - 8));
  }, []);

  const handleFitView = useCallback(() => {
    if (!containerRef.current || milestones.length === 0) return;
    const containerWidth = containerRef.current.clientWidth;
    const fitWidth = Math.max(DAY_WIDTH_MIN, Math.min(DAY_WIDTH_MAX, containerWidth / totalDays));
    setDayWidth(fitWidth);
  }, [milestones.length, totalDays]);

  // Middle mouse drag to pan
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 1) return;
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
  }, []);

  useEffect(() => {
    if (!isPanning) return;
    const handleMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      el.scrollLeft = panStartRef.current.scrollLeft - (e.clientX - panStartRef.current.x);
      el.scrollTop = panStartRef.current.scrollTop - (e.clientY - panStartRef.current.y);
    };
    const handleUp = () => setIsPanning(false);
    document.body.style.cursor = 'grabbing';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isPanning]);

  // Drag handlers - prevent dragging parents with children
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, ms: Milestone, type: 'move' | 'resize-end', isParent: boolean) => {
      if (isParent) return; // Parents with children cannot be dragged
      e.stopPropagation();
      e.preventDefault();
      setDragging({
        id: ms.id,
        type,
        startX: e.clientX,
        origStart: ms.startDate,
        origEnd: ms.endDate,
      });
    },
    [],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragging.startX;
      const dayDelta = Math.round(dx / dayWidth);
      if (dayDelta === 0) return;

      if (dragging.type === 'move') {
        const newStart = addDaysToDate(dragging.origStart, dayDelta);
        const newEnd = addDaysToDate(dragging.origEnd, dayDelta);
        updateMilestone(dragging.id, { startDate: newStart, endDate: newEnd });
      } else {
        const newEnd = addDaysToDate(dragging.origEnd, dayDelta);
        if (newEnd > dragging.origStart) {
          updateMilestone(dragging.id, { endDate: newEnd });
        }
      }
    };

    const handleUp = () => setDragging(null);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, dayWidth, updateMilestone]);

  // Marquee selection handlers
  const handleBarsAreaMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start marquee if clicking on empty space (not on a bar)
      if (e.target !== e.currentTarget) return;
      if (e.button !== 0) return;
      const rect = barsAreaRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scrollEl = containerRef.current;
      const scrollLeft = scrollEl?.scrollLeft ?? 0;
      const scrollTop = scrollEl?.scrollTop ?? 0;
      const x = e.clientX - rect.left + scrollLeft;
      const y = e.clientY - rect.top + scrollTop;
      setMarquee({ startX: x, startY: y, currentX: x, currentY: y });
      if (!e.ctrlKey && !e.metaKey) clearSelection();
    },
    [clearSelection],
  );

  useEffect(() => {
    if (!marquee) return;

    const handleMove = (e: MouseEvent) => {
      const rect = barsAreaRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scrollEl = containerRef.current;
      const scrollLeft = scrollEl?.scrollLeft ?? 0;
      const scrollTop = scrollEl?.scrollTop ?? 0;
      const x = e.clientX - rect.left + scrollLeft;
      const y = e.clientY - rect.top + scrollTop;
      setMarquee((prev) => prev ? { ...prev, currentX: x, currentY: y } : null);
    };

    const handleUp = () => {
      if (!marquee) return;
      // Calculate selection rectangle
      const left = Math.min(marquee.startX, marquee.currentX);
      const right = Math.max(marquee.startX, marquee.currentX);
      const top = Math.min(marquee.startY, marquee.currentY);
      const bottom = Math.max(marquee.startY, marquee.currentY);

      // Only select if dragged a meaningful distance
      if (right - left > 5 || bottom - top > 5) {
        const hitIds: string[] = [];
        displayRows.forEach((row, idx) => {
          const ms = row.milestone;
          const barX = getBarX(ms.startDate);
          const barW = getBarWidth(ms.startDate, ms.endDate);
          const barTop = idx * ROW_HEIGHT + 10;
          const barBottom = idx * ROW_HEIGHT + ROW_HEIGHT - 10;
          // Check AABB intersection
          if (barX + barW > left && barX < right && barBottom > top && barTop < bottom) {
            hitIds.push(ms.id);
          }
        });
        if (hitIds.length > 0) selectMilestones(hitIds);
      }
      setMarquee(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [marquee, displayRows, selectMilestones]);

  // Row drag-to-reorder effect
  useEffect(() => {
    if (!rowDragId) return;

    const handleMove = (e: MouseEvent) => {
      const panel = leftPanelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      const y = e.clientY - rect.top + panel.scrollTop;
      const rowIdx = Math.floor(y / ROW_HEIGHT);

      if (rowIdx < 0 || rowIdx >= displayRows.length) {
        dropTargetRef.current = null;
        setDropLine(null);
        return;
      }

      const row = displayRows[rowIdx];
      const dragMs = milestones.find((m) => m.id === rowDragId);
      const targetMs = milestones.find((m) => m.id === row.milestone.id);
      if (!dragMs || !targetMs || dragMs.parentId !== targetMs.parentId || row.milestone.id === rowDragId) {
        dropTargetRef.current = null;
        setDropLine(null);
        return;
      }

      const rowY = rowIdx * ROW_HEIGHT;
      const midY = rowY + ROW_HEIGHT / 2;
      const position: 'before' | 'after' = y < midY ? 'before' : 'after';
      dropTargetRef.current = { targetId: row.milestone.id, position };
      setDropLine({ idx: rowIdx, position });
    };

    const handleUp = () => {
      if (dropTargetRef.current && rowDragId) {
        reorderMilestone(rowDragId, dropTargetRef.current.targetId, dropTargetRef.current.position);
      }
      dropTargetRef.current = null;
      setRowDragId(null);
      setDropLine(null);
    };

    document.body.style.cursor = 'grabbing';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [rowDragId, displayRows, milestones, reorderMilestone]);

  // Generate date headers
  const dateHeaders = useMemo(() => {
    const headers: { date: string; label: string; isMonth: boolean; x: number }[] = [];
    const startD = new Date(minDate + 'T00:00:00');
    let currentMonth = '';

    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(startD);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const monthLabel = d.toLocaleDateString(locale, { month: 'short', year: 'numeric' });

      if (monthLabel !== currentMonth) {
        currentMonth = monthLabel;
        headers.push({
          date: dateStr,
          label: monthLabel,
          isMonth: true,
          x: i * dayWidth,
        });
      }

      if (dayWidth >= 28) {
        headers.push({
          date: dateStr,
          label: d.getDate().toString(),
          isMonth: false,
          x: i * dayWidth,
        });
      }
    }
    return headers;
  }, [minDate, totalDays, dayWidth, locale]);

  // Today marker
  const todayOffset = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return getDaysBetween(minDate, today) * dayWidth;
  }, [minDate, dayWidth]);

  const getBarX = (date: string) => getDaysBetween(minDate, date) * dayWidth;
  const getBarWidth = (start: string, end: string) =>
    Math.max(getDaysBetween(start, end) * dayWidth, 8);

  const bg = darkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = darkMode ? 'text-gray-200' : 'text-gray-900';
  const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
  const headerBg = darkMode ? 'bg-gray-800' : 'bg-gray-50';
  const hoverBg = darkMode ? 'hover:bg-gray-800' : 'hover:bg-blue-50';

  if (milestones.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${bg} ${textColor}`}>
        <p className="text-gray-500">{t('timeline.empty')}</p>
      </div>
    );
  }

  return (
    <div className={`flex h-full ${bg} ${textColor} select-none`}>
      {/* Left panel - milestone names */}
      <div
        className={`flex-shrink-0 border-r ${borderColor} overflow-hidden`}
        style={{ width: LEFT_PANEL_WIDTH }}
      >
        <div
          className={`${headerBg} border-b ${borderColor} flex items-center px-3 font-semibold text-xs uppercase tracking-wider`}
          style={{ height: HEADER_HEIGHT }}
        >
          {t('timeline.milestones')}
        </div>
        <div className="overflow-y-auto relative" ref={leftPanelRef} style={{ height: `calc(100% - ${HEADER_HEIGHT}px)` }}>
          {displayRows.map((row, idx) => {
            const ms = row.milestone;
            const isDragged = rowDragId === ms.id;
            return (
              <div
                key={ms.id}
                className={`group/row flex items-center gap-1 border-b ${borderColor} cursor-pointer ${hoverBg} transition-colors ${
                  isDragged
                    ? 'opacity-40'
                    : selectedMilestoneIds.includes(ms.id)
                    ? darkMode
                      ? 'bg-blue-900/40'
                      : 'bg-blue-50'
                    : row.isParent
                    ? darkMode
                      ? 'bg-gray-800/60'
                      : 'bg-gray-100/80'
                    : ''
                }`}
                style={{ height: ROW_HEIGHT, paddingLeft: row.indent * INDENT_PX }}
                onClick={(e) => e.ctrlKey || e.metaKey ? toggleMilestoneSelection(ms.id) : selectMilestone(ms.id)}
                onDoubleClick={() => {
                  const original = milestones.find((m) => m.id === ms.id);
                  if (original) setEditingMilestone(original);
                }}
              >
                {/* Drag handle */}
                <div
                  className={`flex-shrink-0 cursor-grab opacity-0 group-hover/row:opacity-40 hover:!opacity-100 transition-opacity px-0.5 ${
                    darkMode ? 'text-gray-400' : 'text-gray-400'
                  }`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setRowDragId(ms.id);
                  }}
                >
                  <GripVertical size={14} />
                </div>
                {/* Collapse toggle for parents */}
                {row.isParent ? (
                  <button
                    className={`p-0.5 rounded ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-300'} transition-colors`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroupCollapse(ms.id);
                    }}
                  >
                    {row.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                ) : (
                  <div style={{ width: 22 }} />
                )}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: ms.color }}
                />
                <span className={`text-sm truncate ${row.isParent ? 'font-bold' : ''}`}>{ms.title}</span>
              </div>
            );
          })}
          {/* Drop indicator line */}
          {dropLine && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{
                top: (dropLine.position === 'before' ? dropLine.idx : dropLine.idx + 1) * ROW_HEIGHT - 1,
                height: 2,
                backgroundColor: '#3b82f6',
              }}
            />
          )}
        </div>
      </div>

      {/* Right panel - timeline bars */}
      <div className="flex-1 relative overflow-hidden">
        <div className={`h-full overflow-auto ${isPanning ? '!cursor-grabbing' : ''}`} onScroll={handleScroll} onWheel={handleWheel} onMouseDown={handlePanStart} ref={containerRef}>
          {/* Date headers */}
          <div
            className={`sticky top-0 z-10 ${headerBg} border-b ${borderColor}`}
            style={{
              height: HEADER_HEIGHT,
              width: totalDays * dayWidth,
              minWidth: '100%',
            }}
          >
            {dateHeaders.map((h, i) =>
              h.isMonth ? (
                <div
                  key={`month-${i}`}
                  className="absolute top-1 text-xs font-bold"
                  style={{ left: h.x + 4, color: darkMode ? '#9ca3af' : '#6b7280' }}
                >
                  {h.label}
                </div>
              ) : (
                <div
                  key={`day-${i}`}
                  className="absolute bottom-1 text-[10px]"
                  style={{
                    left: h.x,
                    width: dayWidth,
                    textAlign: 'center',
                    color: darkMode ? '#6b7280' : '#9ca3af',
                  }}
                >
                  {h.label}
                </div>
              ),
            )}
          </div>

          {/* Bars area */}
          <div
            ref={barsAreaRef}
            className="relative"
            style={{
              width: totalDays * dayWidth,
              minWidth: '100%',
              height: displayRows.length * ROW_HEIGHT,
            }}
            onMouseDown={handleBarsAreaMouseDown}
          >
            {/* Grid lines */}
            {dateHeaders
              .filter((h) => h.isMonth)
              .map((h, i) => (
                <div
                  key={`grid-${i}`}
                  className="absolute top-0 bottom-0 border-l"
                  style={{
                    left: h.x,
                    borderColor: darkMode ? '#374151' : '#e5e7eb',
                  }}
                />
              ))}

            {/* Today marker */}
            <div
              className="absolute top-0 bottom-0 z-10"
              style={{ left: todayOffset, width: 2, backgroundColor: '#ef4444' }}
            >
              <div className="absolute -top-0 -left-3 bg-red-500 text-white text-[9px] px-1 rounded">
                {t('timeline.today')}
              </div>
            </div>

            {/* Row backgrounds */}
            {displayRows.map((row, idx) => (
              <div
                key={`row-${row.milestone.id}`}
                className={`absolute left-0 right-0 border-b ${borderColor} ${
                  selectedMilestoneIds.includes(row.milestone.id)
                    ? darkMode
                      ? 'bg-blue-900/20'
                      : 'bg-blue-50/50'
                    : row.isParent
                    ? darkMode
                      ? 'bg-gray-800/40'
                      : 'bg-gray-100/60'
                    : idx % 2 === 1
                    ? darkMode
                      ? 'bg-gray-800/30'
                      : 'bg-gray-50/50'
                    : ''
                }`}
                style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT }}
              />
            ))}

            {/* Dependency arrows - skip arrows to/from hidden children */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: totalDays * dayWidth, height: displayRows.length * ROW_HEIGHT }}
            >
              {displayRows.map((row) => {
                const ms = row.milestone;
                return ms.dependencies.map((depId) => {
                  // Skip if either end is not visible
                  if (!visibleIds.has(depId)) return null;
                  const depIdx = rowIndexById.get(depId);
                  const msIdx = rowIndexById.get(ms.id);
                  if (depIdx === undefined || msIdx === undefined) return null;

                  const depMs = displayRows[depIdx].milestone;
                  const fromX = getBarX(depMs.endDate);
                  const fromY = depIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const toX = getBarX(ms.startDate);
                  const toY = msIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const isCritical = criticalPath.has(ms.id) && criticalPath.has(depId);

                  return (
                    <g key={`dep-${depId}-${ms.id}`}>
                      <path
                        d={`M ${fromX} ${fromY} C ${fromX + 30} ${fromY}, ${toX - 30} ${toY}, ${toX} ${toY}`}
                        fill="none"
                        stroke={isCritical ? '#ef4444' : darkMode ? '#4b5563' : '#d1d5db'}
                        strokeWidth={isCritical ? 2.5 : 1.5}
                        strokeDasharray={isCritical ? '' : '4,2'}
                      />
                      <polygon
                        points={`${toX},${toY} ${toX - 6},${toY - 4} ${toX - 6},${toY + 4}`}
                        fill={isCritical ? '#ef4444' : darkMode ? '#4b5563' : '#d1d5db'}
                      />
                    </g>
                  );
                });
              })}
            </svg>

            {/* Marquee selection overlay */}
            {marquee && (
              <div
                className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-20"
                style={{
                  left: Math.min(marquee.startX, marquee.currentX),
                  top: Math.min(marquee.startY, marquee.currentY),
                  width: Math.abs(marquee.currentX - marquee.startX),
                  height: Math.abs(marquee.currentY - marquee.startY),
                }}
              />
            )}

            {/* Milestone bars */}
            {displayRows.map((row, idx) => {
              const ms = row.milestone;
              const x = getBarX(ms.startDate);
              const width = getBarWidth(ms.startDate, ms.endDate);
              const isCritical = criticalPath.has(ms.id);
              const isSelected = selectedMilestoneIds.includes(ms.id);

              // Parent: thin summary bar with diamond endpoints
              if (row.isParent) {
                const barY = ROW_HEIGHT / 2;
                return (
                  <svg
                    key={ms.id}
                    className="absolute pointer-events-auto cursor-pointer"
                    style={{ left: 0, top: idx * ROW_HEIGHT, width: totalDays * dayWidth, height: ROW_HEIGHT }}
                    onClick={(e: React.MouseEvent) => e.ctrlKey || e.metaKey ? toggleMilestoneSelection(ms.id) : selectMilestone(ms.id)}
                    onDoubleClick={() => {
                      const original = milestones.find((m) => m.id === ms.id);
                      if (original) setEditingMilestone(original);
                    }}
                  >
                    {/* Summary line */}
                    <rect
                      x={x}
                      y={barY - 3}
                      width={width}
                      height={6}
                      rx={2}
                      fill={ms.color}
                      opacity={0.7}
                      className={isSelected ? 'stroke-blue-500' : ''}
                      strokeWidth={isSelected ? 2 : 0}
                    />
                    {/* Left diamond */}
                    <polygon
                      points={`${x},${barY} ${x + 5},${barY - 6} ${x + 10},${barY} ${x + 5},${barY + 6}`}
                      fill={ms.color}
                    />
                    {/* Right diamond */}
                    <polygon
                      points={`${x + width - 10},${barY} ${x + width - 5},${barY - 6} ${x + width},${barY} ${x + width - 5},${barY + 6}`}
                      fill={ms.color}
                    />
                  </svg>
                );
              }

              // Normal child/top-level bar
              return (
                <div
                  key={ms.id}
                  className="absolute group"
                  style={{
                    left: x,
                    top: idx * ROW_HEIGHT + 10,
                    width,
                    height: ROW_HEIGHT - 20,
                  }}
                >
                  <div
                    className={`absolute inset-0 rounded-md cursor-pointer transition-all ${
                      isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                    } ${isCritical ? 'ring-1 ring-red-400' : ''}`}
                    style={{
                      backgroundColor: ms.color + '33',
                      border: `2px solid ${ms.color}`,
                    }}
                    onClick={(e) => e.ctrlKey || e.metaKey ? toggleMilestoneSelection(ms.id) : selectMilestone(ms.id)}
                    onDoubleClick={() => setEditingMilestone(ms)}
                    onMouseDown={(e) => handleMouseDown(e, ms, 'move', false)}
                  >
                    <div
                      className="absolute inset-0 rounded-md transition-all"
                      style={{
                        width: `${ms.progress}%`,
                        backgroundColor: ms.color + '66',
                      }}
                    />
                    {width > 60 && (
                      <span className="absolute inset-0 flex items-center px-2 text-xs font-medium truncate z-10"
                        style={{ color: darkMode ? '#fff' : '#1f2937' }}
                      >
                        {ms.title}
                      </span>
                    )}
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: ms.color }}
                    onMouseDown={(e) => handleMouseDown(e, ms, 'resize-end', false)}
                  />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block z-20">
                    <div className={`${darkMode ? 'bg-gray-800' : 'bg-gray-900'} text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg`}>
                      <div className="font-semibold">{ms.title}</div>
                      <div>{formatDate(ms.startDate, locale)} - {formatDate(ms.endDate, locale)}</div>
                      <div>{t('timeline.progress', { value: ms.progress })}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <TimelineZoomControls
          dayWidth={dayWidth}
          minDayWidth={DAY_WIDTH_MIN}
          maxDayWidth={DAY_WIDTH_MAX}
          defaultDayWidth={DAY_WIDTH_DEFAULT}
          darkMode={darkMode}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitView={handleFitView}
        />
      </div>
    </div>
  );
}

function addDaysToDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
