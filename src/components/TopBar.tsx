import { LogOut, Menu } from 'lucide-react';
import type { DeviceStatusState, OperationMode, PublicUser } from '../../shared/urinalysis.ts';
import { DeviceConnectionIndicator } from './StatusIndicator.tsx';

interface TopBarProps {
  title: string;
  subtitle: string;
  deviceStatus: DeviceStatusState;
  mode: OperationMode;
  onToggleMode: (mode: OperationMode) => void;
  user: PublicUser;
  onLogout: () => void;
  onOpenMobileMenu: () => void;
}

export function TopBar({
  title,
  subtitle,
  deviceStatus,
  mode,
  onToggleMode,
  user,
  onLogout,
  onOpenMobileMenu,
}: TopBarProps) {
  return (
    <header className="h-16 bg-white border-b border-[#D6E4F0] px-4 lg:px-7 flex items-center justify-between gap-4 shrink-0 no-print">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-[#24364B] hover:bg-[#EAF5FF] cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-[#164B78] truncate">{title}</h1>
          <p className="text-xs text-[#64748B] truncate hidden sm:block">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {/* Live Connection Indicator */}
        <div className="hidden md:flex items-center px-3 py-1.5 rounded-lg bg-[#F8FBFF] border border-[#D6E4F0]">
          <DeviceConnectionIndicator state={deviceStatus.connectionState} />
        </div>

        {/* Demo / Real IoT Mode Segmented Switch */}
        <div
          className="flex items-center p-0.5 rounded-lg bg-[#EAF5FF] border border-[#D6E4F0]"
          role="group"
          aria-label="Operation mode"
        >
          <button
            type="button"
            onClick={() => onToggleMode('demo')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'demo'
                ? 'bg-white text-[#164B78] shadow-xs font-semibold'
                : 'text-[#24364B] hover:text-[#2685D8]'
            }`}
          >
            Demo Mode
          </button>
          <button
            type="button"
            onClick={() => onToggleMode('real')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'real'
                ? 'bg-[#2685D8] text-white shadow-xs font-semibold'
                : 'text-[#24364B] hover:text-[#2685D8]'
            }`}
          >
            Real IoT Mode
          </button>
        </div>

        {/* User Account */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-[#D6E4F0]">
          <img
            src="/src/assets/images/clinician_profile_avatar_1795067620030.jpg"
            alt={user.name}
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full object-cover border border-[#D6E4F0] bg-[#EAF5FF] hidden sm:block"
          />
          <div className="hidden xl:block text-right">
            <div className="text-xs font-semibold text-[#24364B] leading-tight whitespace-nowrap">{user.name}</div>
            <div className="text-[11px] text-[#64748B] leading-tight whitespace-nowrap">{user.role}</div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-lg text-[#64748B] hover:bg-[#EAF5FF] hover:text-[#164B78] transition-colors cursor-pointer"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
