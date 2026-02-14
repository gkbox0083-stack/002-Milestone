import { useRef, useEffect } from 'react';
import { useStore } from './store/useStore';
import Header from './components/Header';
import TimelineView from './components/TimelineView';
import NetworkView from './components/NetworkView';
import EditPanel from './components/EditPanel';
import TableView from './components/TableView';

export default function App() {
  const { viewMode, editingMilestone, darkMode, selectedMilestoneIds, deleteMilestone, clearSelection } = useStore();
  const mainRef = useRef<HTMLDivElement>(null);

  // Delete key shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (editingMilestone) return;
      if (selectedMilestoneIds.length === 0) return;
      e.preventDefault();
      const ids = [...selectedMilestoneIds];
      ids.forEach((id) => deleteMilestone(id));
      clearSelection();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMilestoneIds, editingMilestone, deleteMilestone, clearSelection]);

  const bg = darkMode ? 'bg-gray-950' : 'bg-gray-100';

  return (
    <div className={`h-screen flex flex-col ${bg}`}>
      <Header mainRef={mainRef} />

      <main ref={mainRef} className="flex-1 overflow-hidden">
        {viewMode === 'timeline' && (
          <div className="h-full">
            <TimelineView />
          </div>
        )}

        {viewMode === 'network' && (
          <div className="h-full">
            <NetworkView />
          </div>
        )}

        {viewMode === 'table' && (
          <div className="h-full">
            <TableView />
          </div>
        )}

        {viewMode === 'split' && (
          <div className="h-full flex flex-col lg:flex-row">
            <div className="h-1/2 lg:h-full lg:w-1/2 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700">
              <TimelineView />
            </div>
            <div className="h-1/2 lg:h-full lg:w-1/2">
              <NetworkView />
            </div>
          </div>
        )}
      </main>

      {editingMilestone && <EditPanel />}
    </div>
  );
}
