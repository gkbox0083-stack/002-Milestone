import type { RefObject } from 'react';
import { useState } from 'react';
import {
  Plus,
  Sun,
  Moon,
  LayoutGrid,
  GanttChart,
  Network,
  Download,
  Upload,
  Database,
  BookOpen,
  FileSpreadsheet,
  Camera,
  Table2,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { generateCSV } from '../utils/csv';
import type { ViewMode } from '../types';
import DocsModal from './DocsModal';

const VIEW_MODES: ViewMode[] = ['timeline', 'network', 'split', 'table'];
const VIEW_ICONS = { timeline: GanttChart, network: Network, split: LayoutGrid, table: Table2 };

export default function Header({ mainRef }: { mainRef: RefObject<HTMLDivElement | null> }) {
  const {
    project,
    viewMode,
    setViewMode,
    addMilestone,
    setEditingMilestone,
    setProjectName,
    toggleDarkMode,
    darkMode,
    language,
    setLanguage,
    loadSampleData,
  } = useStore();

  const { t } = useTranslation();
  const [showDocs, setShowDocs] = useState(false);

  const handleAddMilestone = () => {
    const ms = addMilestone();
    setEditingMilestone(ms);
  };

  const handleExport = () => {
    const data = JSON.stringify(project, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_milestones.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.milestones) {
            // Migrate imported milestones: ensure parentId exists
            data.milestones = data.milestones.map((m: Record<string, unknown>) => ({
              ...m,
              parentId: m.parentId ?? null,
            }));
            useStore.setState({ project: data });
          }
        } catch {
          alert(t('header.invalid_json'));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExportCSV = () => {
    const csv = generateCSV(project.milestones);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_milestones.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleScreenshot = async () => {
    if (!mainRef.current) return;
    try {
      const dataUrl = await toPng(mainRef.current, {
        backgroundColor: darkMode ? '#030712' : '#f3f4f6',
        pixelRatio: 2,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${project.name.replace(/\s+/g, '_')}_screenshot.png`;
      a.click();
    } catch {
      // silently fail
    }
  };

  const bg = darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200';
  const textColor = darkMode ? 'text-gray-200' : 'text-gray-900';
  const btnClass = darkMode
    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-600'
    : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200';

  return (
    <header className={`flex items-center justify-between px-4 h-14 border-b ${bg} ${textColor} flex-shrink-0`}>
      {/* Left: Project name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            M
          </div>
          <input
            type="text"
            value={project.name}
            onChange={(e) => setProjectName(e.target.value)}
            className={`text-lg font-bold bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 ${textColor}`}
            style={{ width: Math.max(120, project.name.length * 11) }}
          />
        </div>
        <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('header.milestones_count', { count: project.milestones.length })}
        </span>
      </div>

      {/* Center: View toggle */}
      <div className={`flex items-center rounded-lg border ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'} p-0.5`}>
        {VIEW_MODES.map((mode) => {
          const Icon = VIEW_ICONS[mode];
          return (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === mode
                  ? 'bg-blue-500 text-white shadow-sm'
                  : darkMode
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{t(`header.${mode}`)}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {project.milestones.length === 0 && (
          <button
            onClick={loadSampleData}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${btnClass} transition-colors`}
            title={t('header.sample_tooltip')}
          >
            <Database size={15} />
            <span className="hidden md:inline">{t('header.sample')}</span>
          </button>
        )}
        <button
          onClick={handleImport}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${btnClass} transition-colors`}
          title={t('header.import_tooltip')}
        >
          <Upload size={15} />
        </button>
        <button
          onClick={handleExport}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${btnClass} transition-colors`}
          title={t('header.export_tooltip')}
        >
          <Download size={15} />
        </button>
        <button
          onClick={handleExportCSV}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${btnClass} transition-colors`}
          title={t('header.export_csv_tooltip')}
        >
          <FileSpreadsheet size={15} />
        </button>
        <button
          onClick={handleScreenshot}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${btnClass} transition-colors`}
          title={t('header.screenshot_tooltip')}
        >
          <Camera size={15} />
        </button>
        <button
          onClick={() => setShowDocs(true)}
          className={`p-2 rounded-lg border ${btnClass} transition-colors`}
          title={t('header.docs_tooltip')}
        >
          <BookOpen size={16} />
        </button>
        <button
          onClick={toggleDarkMode}
          className={`p-2 rounded-lg border ${btnClass} transition-colors`}
          title={t('header.darkmode_tooltip')}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={() => setLanguage(language === 'en' ? 'zh-TW' : 'en')}
          className={`px-2.5 py-1.5 rounded-lg border text-sm font-medium ${btnClass} transition-colors`}
          title={language === 'en' ? '切換至繁體中文' : 'Switch to English'}
        >
          {t('header.lang_toggle')}
        </button>
        <button
          onClick={handleAddMilestone}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium shadow-sm"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">{t('header.add_milestone')}</span>
        </button>
      </div>

      {showDocs && <DocsModal onClose={() => setShowDocs(false)} />}
    </header>
  );
}
