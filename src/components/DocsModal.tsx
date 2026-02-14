import { X, GanttChart, Network, Pencil, FolderInput, Keyboard, Table2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';

interface DocsModalProps {
  onClose: () => void;
}

const SECTIONS = [
  { key: 'timeline', icon: GanttChart },
  { key: 'network', icon: Network },
  { key: 'table', icon: Table2 },
  { key: 'editing', icon: Pencil },
  { key: 'import_export', icon: FolderInput },
  { key: 'shortcuts', icon: Keyboard },
] as const;

export default function DocsModal({ onClose }: DocsModalProps) {
  const darkMode = useStore((s) => s.darkMode);
  const { t } = useTranslation();

  const bg = darkMode ? 'bg-gray-800' : 'bg-white';
  const textColor = darkMode ? 'text-gray-200' : 'text-gray-900';
  const borderColor = darkMode ? 'border-gray-600' : 'border-gray-300';
  const sectionBg = darkMode ? 'bg-gray-700/50' : 'bg-gray-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`${bg} ${textColor} rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-7 py-5 border-b ${borderColor} flex-shrink-0`}>
          <h2 className="text-lg font-bold">{t('docs.title')}</h2>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg hover:bg-gray-200 ${darkMode ? 'hover:bg-gray-700' : ''} transition-colors`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-5 space-y-4 overflow-y-auto flex-1">
          {SECTIONS.map(({ key, icon: Icon }) => (
            <div key={key} className={`rounded-xl p-4 ${sectionBg}`}>
              <div className="flex items-center gap-2.5 mb-2">
                <Icon size={18} className="text-blue-500 flex-shrink-0" />
                <h3 className="font-semibold text-sm">{t(`docs.section_${key}`)}</h3>
              </div>
              <p className={`text-sm leading-relaxed whitespace-pre-line ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {t(`docs.section_${key}_desc`)}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={`flex justify-end px-7 py-4 border-t ${borderColor} flex-shrink-0`}>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            {t('docs.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
