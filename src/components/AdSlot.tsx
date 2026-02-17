import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSlotProps {
  adClient?: string;
  adSlot?: string;
}

export default function AdSlot({ adClient, adSlot }: AdSlotProps) {
  const darkMode = useStore((s) => s.darkMode);
  const adDismissed = useStore((s) => s.adDismissed);
  const dismissAd = useStore((s) => s.dismissAd);
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  const isAdsense = adClient && adSlot;

  useEffect(() => {
    if (!isAdsense || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // adsbygoogle not loaded
    }
  }, [isAdsense]);

  if (adDismissed) return null;

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 border-t ${
        darkMode
          ? 'bg-gray-900 border-gray-700'
          : 'bg-gray-50 border-gray-200'
      }`}
      style={{ height: 'auto', minHeight: 50 }}
    >
      {isAdsense ? (
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={adClient}
          data-ad-slot={adSlot}
          data-ad-format="horizontal"
          data-full-width-responsive="true"
        />
      ) : (
        <div
          className={`flex items-center justify-center w-full text-xs tracking-wide select-none ${
            darkMode ? 'text-gray-500' : 'text-gray-400'
          }`}
          style={{ height: 50 }}
        >
          <span className="hidden sm:inline" style={{ lineHeight: '90px' }}>
            <span
              className={`inline-flex items-center justify-center border border-dashed rounded ${
                darkMode ? 'border-gray-600' : 'border-gray-300'
              }`}
              style={{ width: 728, height: 90 }}
            >
              Advertisement
            </span>
          </span>
          <span className="sm:hidden" style={{ lineHeight: '50px' }}>
            <span
              className={`inline-flex items-center justify-center border border-dashed rounded ${
                darkMode ? 'border-gray-600' : 'border-gray-300'
              }`}
              style={{ width: 320, height: 50 }}
            >
              Advertisement
            </span>
          </span>
        </div>
      )}

      <button
        onClick={dismissAd}
        className={`absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full text-xs leading-none cursor-pointer transition-colors ${
          darkMode
            ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
        }`}
        aria-label="Close ad"
      >
        &times;
      </button>
    </div>
  );
}
