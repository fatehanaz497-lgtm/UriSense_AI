import { AlertCircle, AlertTriangle, CheckCircle2, Activity, Wifi, WifiOff, Loader2, MinusCircle } from 'lucide-react';
import type { DeviceConnectionState, OverallTestStatus, ParameterStatus } from '../../shared/urinalysis.ts';

export function ParameterStatusText({ status }: { status: ParameterStatus | OverallTestStatus }) {
  if (status === 'Normal') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#16A34A] whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Normal</span>
      </span>
    );
  }
  if (status === 'Needs Review') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D97706] whitespace-nowrap shrink-0">
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Needs Review</span>
      </span>
    );
  }
  if (status === 'Abnormal') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626] whitespace-nowrap shrink-0">
        <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Abnormal</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] whitespace-nowrap shrink-0">
      <MinusCircle className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Not Measured</span>
    </span>
  );
}

export function DeviceConnectionIndicator({
  state,
  compact = false,
}: {
  state: DeviceConnectionState;
  compact?: boolean;
}) {
  if (state === 'Device Connected') {
    return (
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#16A34A] whitespace-nowrap shrink-0">
        <span className="w-2 h-2 rounded-full bg-[#16A34A]" aria-hidden="true" />
        {!compact && <Wifi className="w-3.5 h-3.5" aria-hidden="true" />}
        <span>Device Connected</span>
      </div>
    );
  }
  if (state === 'Data Receiving') {
    return (
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#2685D8] whitespace-nowrap shrink-0">
        <span className="w-2 h-2 rounded-full bg-[#2685D8] animate-pulse" aria-hidden="true" />
        {!compact && <Activity className="w-3.5 h-3.5" aria-hidden="true" />}
        <span>Data Receiving</span>
      </div>
    );
  }
  if (state === 'Processing Sample') {
    return (
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#D97706] whitespace-nowrap shrink-0">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        <span>Processing Sample</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#DC2626] whitespace-nowrap shrink-0">
      <span className="w-2 h-2 rounded-full bg-[#DC2626]" aria-hidden="true" />
      {!compact && <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />}
      <span>Device Disconnected</span>
    </div>
  );
}
