import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export function StatusBar({ bootTime, sidecarStatus }: { bootTime: number, sidecarStatus: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (sidecarStatus === 'connected') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - bootTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sidecarStatus, bootTime]);

  const isBooting = elapsed < 30 && sidecarStatus !== 'connected';

  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider bg-surface-container-lowest border border-border-default px-2.5 py-1 rounded-md shadow-xs">
        {sidecarStatus === 'connected' ? (
          <span className="text-emerald-600 flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 
            Online
          </span>
        ) : isBooting ? (
          <span className="text-amber-600 flex items-center gap-2 font-medium">
            <Loader2 size={12} className="animate-spin" /> 
            Waking up ({elapsed}s)
          </span>
        ) : (
          <span className="text-rose-600 flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> 
            Disconnected
          </span>
        )}
    </div>
  );
}
