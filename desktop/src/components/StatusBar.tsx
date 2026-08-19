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
    <div className="h-10 bg-surface-container-lowest text-on-surface-variant text-[12px] font-medium flex items-center px-6 border-t border-outline-variant justify-between shrink-0 select-none z-20">
      <div className="flex items-center gap-4">
        <span className="text-on-surface-variant">Recall v0.2.0</span>
      </div>
      <div className="flex items-center gap-2">
        <span>Engine:</span>
        {sidecarStatus === 'connected' ? (
          <span className="text-accent-blue flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-accent-blue"></span> 
            Online
          </span>
        ) : isBooting ? (
          <span className="text-amber-600 flex items-center gap-2 font-medium">
            <Loader2 size={12} className="animate-spin" /> 
            Waking up ({elapsed}s)
          </span>
        ) : (
          <span className="text-error flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-error"></span> 
            Disconnected
          </span>
        )}
      </div>
    </div>
  );
}
