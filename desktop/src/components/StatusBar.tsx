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
    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-surface border-2 border-on-surface px-2.5 py-1 rounded-md shadow-[2px_2px_0px_0px_#191b23]">
        {sidecarStatus === 'connected' ? (
          <span className="text-green-600 flex items-center gap-1.5 font-black">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> 
            Online
          </span>
        ) : isBooting ? (
          <span className="text-amber-600 flex items-center gap-2 font-medium">
            <Loader2 size={12} className="animate-spin" /> 
            Waking up ({elapsed}s)
          </span>
        ) : (
          <span className="text-red-600 flex items-center gap-1.5 font-black">
            <span className="w-2 h-2 rounded-full bg-red-500"></span> 
            Disconnected
          </span>
        )}
    </div>
  );
}
