import { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Link2Off } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import type { MilestoneStatus } from '../types';
import { MILESTONE_COLORS } from '../types';
import { canBeParent, getChildren, getEffectiveMilestone, wouldCreateCycle } from '../utils';

const STATUS_KEYS: MilestoneStatus[] = ['not_started', 'in_progress', 'completed', 'at_risk', 'blocked'];

export default function EditPanel() {
  const {
    editingMilestone,
    setEditingMilestone,
    updateMilestone,
    deleteMilestone,
    project,
    darkMode,
  } = useStore();

  const { t } = useTranslation();
  const [form, setForm] = useState(editingMilestone);

  useEffect(() => {
    setForm(editingMilestone);
  }, [editingMilestone]);

  // Compute whether this milestone has children (is a group parent)
  const hasChildren = useMemo(() => {
    if (!form) return false;
    return getChildren(project.milestones, form.id).length > 0;
  }, [form, project.milestones]);

  // Effective milestone with aggregated values for parents
  const effective = useMemo(() => {
    if (!form || !hasChildren) return null;
    return getEffectiveMilestone(project.milestones, form);
  }, [form, hasChildren, project.milestones]);

  // Eligible parents for the dropdown
  const eligibleParents = useMemo(() => {
    if (!form) return [];
    return project.milestones.filter(
      (m) => m.id !== form.id && canBeParent(project.milestones, m.id, form.id),
    );
  }, [form, project.milestones]);

  if (!form || !editingMilestone) return null;

  const otherMilestones = project.milestones.filter((m) => m.id !== form.id);
  const currentDeps = form.dependencies;

  const handleSave = () => {
    updateMilestone(form.id, form);
    setEditingMilestone(null);
  };

  const handleDelete = () => {
    deleteMilestone(form.id);
    setEditingMilestone(null);
  };

  const bg = darkMode ? 'bg-gray-800' : 'bg-white';
  const textColor = darkMode ? 'text-gray-200' : 'text-gray-900';
  const borderColor = darkMode ? 'border-gray-600' : 'border-gray-300';
  const inputBg = darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900';
  const labelColor = darkMode ? 'text-gray-300' : 'text-gray-700';
  const autoLabel = ` ${t('edit.auto_calculated')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className={`${bg} ${textColor} rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-7 py-5 border-b ${borderColor} flex-shrink-0`}>
          <h2 className="text-lg font-bold">{t('edit.title')}</h2>
          <button
            onClick={() => setEditingMilestone(null)}
            className={`p-1.5 rounded-lg hover:bg-gray-200 ${darkMode ? 'hover:bg-gray-700' : ''} transition-colors`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-7 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${labelColor}`}>{t('edit.field_title')}</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={`w-full px-3 py-2.5 rounded-lg border ${borderColor} ${inputBg} focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm`}
            />
          </div>

          {/* Description */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${labelColor}`}>{t('edit.field_description')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className={`w-full px-3 py-2.5 rounded-lg border ${borderColor} ${inputBg} focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-sm`}
            />
          </div>

          {/* Status & Progress */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${labelColor}`}>
                {t('edit.field_status')}{hasChildren ? autoLabel : ''}
              </label>
              {hasChildren && effective ? (
                <div className={`w-full px-3 py-2.5 rounded-lg border ${borderColor} ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'} text-sm opacity-75`}>
                  {t(`status.${effective.status}`)}
                </div>
              ) : (
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as MilestoneStatus })}
                  className={`w-full px-3 py-2.5 rounded-lg border ${borderColor} ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none text-sm`}
                >
                  {STATUS_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {t(`status.${key}`)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${labelColor}`}>
                {t('edit.field_progress')}{hasChildren ? autoLabel : ''}
              </label>
              {hasChildren && effective ? (
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${borderColor} ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                  <div className={`flex-1 h-2 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${effective.progress}%`, backgroundColor: form.color }}
                    />
                  </div>
                  <span className={`text-sm font-medium tabular-nums w-10 text-right opacity-75`}>
                    {effective.progress}%
                  </span>
                </div>
              ) : (
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${borderColor} ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={form.progress}
                    onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
                    className="flex-1 accent-blue-500"
                  />
                  <span className={`text-sm font-medium tabular-nums w-10 text-right ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    {form.progress}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${labelColor}`}>
                {t('edit.field_start_date')}{hasChildren ? autoLabel : ''}
              </label>
              {hasChildren && effective ? (
                <div className={`w-full px-3 py-2.5 rounded-lg border ${borderColor} ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'} text-sm opacity-75`}>
                  {effective.startDate}
                </div>
              ) : (
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-lg border ${borderColor} ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none text-sm`}
                />
              )}
            </div>
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${labelColor}`}>
                {t('edit.field_end_date')}{hasChildren ? autoLabel : ''}
              </label>
              {hasChildren && effective ? (
                <div className={`w-full px-3 py-2.5 rounded-lg border ${borderColor} ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'} text-sm opacity-75`}>
                  {effective.endDate}
                </div>
              ) : (
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-lg border ${borderColor} ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none text-sm`}
                />
              )}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${labelColor}`}>{t('edit.field_color')}</label>
            <div className="flex gap-3 flex-wrap">
              {MILESTONE_COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-7 h-7 rounded-full transition-all ${
                    form.color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setForm({ ...form, color: c })}
                />
              ))}
            </div>
          </div>

          {/* Dependencies */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${labelColor}`}>
              {t('edit.field_dependencies')}
            </label>
            {currentDeps.length > 0 && (
              <div className="space-y-1 mb-2">
                {currentDeps.map((depId) => {
                  const dep = project.milestones.find((m) => m.id === depId);
                  if (!dep) return null;
                  return (
                    <div
                      key={depId}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${
                        darkMode ? 'bg-gray-700' : 'bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: dep.color }}
                        />
                        <span className="text-sm">{dep.title}</span>
                      </div>
                      <button
                        onClick={() => {
                          const newDeps = form.dependencies.filter((d) => d !== depId);
                          setForm({ ...form, dependencies: newDeps });
                        }}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Link2Off size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {(() => {
              // Build a virtual milestones array with current form deps to check cycles accurately
              const virtualMilestones = project.milestones.map((m) =>
                m.id === form.id ? { ...m, dependencies: form.dependencies } : m,
              );
              const available = otherMilestones.filter(
                (m) => !currentDeps.includes(m.id) && !wouldCreateCycle(virtualMilestones, form.id, m.id),
              );
              return available.length > 0 ? (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setForm({ ...form, dependencies: [...form.dependencies, e.target.value] });
                    }
                  }}
                  className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none text-sm`}
                >
                  <option value="">{t('edit.add_dependency')}</option>
                  {available.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              ) : null;
            })()}
          </div>

          {/* Parent Group */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${labelColor}`}>
              {t('edit.field_parent')}
            </label>
            {hasChildren ? (
              <div className={`px-3 py-2.5 rounded-lg border ${borderColor} ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'} text-sm opacity-75 italic`}>
                {t('edit.parent_has_children')}
              </div>
            ) : (
              <select
                value={form.parentId ?? ''}
                onChange={(e) => setForm({ ...form, parentId: e.target.value || null })}
                className={`w-full px-3 py-2.5 rounded-lg border ${borderColor} ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none text-sm`}
              >
                <option value="">{t('edit.no_parent')}</option>
                {eligibleParents.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-7 py-5 border-t ${borderColor} flex-shrink-0`}>
          <button
            onClick={handleDelete}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm text-red-500 rounded-lg transition-colors ${darkMode ? 'hover:bg-red-900/30' : 'hover:bg-red-50'}`}
          >
            <Trash2 size={15} />
            {t('edit.delete')}
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setEditingMilestone(null)}
              className={`px-5 py-2.5 text-sm rounded-lg border ${borderColor} transition-colors ${
                darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
            >
              {t('edit.cancel')}
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              {t('edit.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
