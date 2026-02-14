import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { translations } from './translations';
import type { Language } from './translations';

export type { Language };

export function useTranslation() {
  const language = useStore((s) => s.language);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let text = translations[language]?.[key] ?? translations.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [language],
  );

  return { t, language };
}
