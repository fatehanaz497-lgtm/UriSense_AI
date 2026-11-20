import {
  Activity,
  Bot,
  Cpu,
  Droplets,
  FileText,
  FlaskConical,
  History,
  LayoutDashboard,
  Settings,
  Users,
  X,
} from 'lucide-react';
import type { OperationMode } from '../../shared/urinalysis.ts';

export type NavRoute =
  | 'dashboard'
  | 'new-test'
  | 'test-results'
  | 'patients'
  | 'device-monitoring'
  | 'ai-assistant'
  | 'test-history'
  | 'reports'
  | 'settings';

export const NAV_ITEMS: Array<{ id: NavRoute; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'new-test', label: 'New Urine Test', icon: FlaskConical },
  { id: 'test-results', label: 'Test Results', icon: Activity },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'device-monitoring', label: 'Device Monitoring', icon: Cpu },
  { id: 'ai-assistant', label: 'AI Assistant', icon: Bot },
  { id: 'test-history', label: 'Test History', icon: History },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  activeRoute: NavRoute;
  onNavigate: (route: NavRoute) => void;
  mode: OperationMode;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ activeRoute, onNavigate, mode, mobileOpen, onCloseMobile }: SidebarProps) {
  const content = (
    <div className="flex flex-col h-full bg-white border-r border-[#D6E4F0] w-[260px]">
      {/* Brand */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-[#D6E4F0]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#2685D8] flex items-center justify-center text-white shadow-xs">
            <Droplets className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="font-semibold text-[16px] leading-tight text-[#164B78] tracking-tight whitespace-nowrap">
              UriSense AI
            </div>
            <div className="text-[11px] text-[#64748B] whitespace-nowrap">
              Smart AIoT Urinalysis
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-md text-[#64748B] hover:bg-[#EAF5FF] hover:text-[#164B78]"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#EAF5FF] text-[#164B78] font-semibold'
                  : 'text-[#24364B] hover:bg-[#F5FAFF] hover:text-[#2685D8]'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#2685D8]' : 'text-[#64748B]'}`}
                aria-hidden="true"
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mode Clarity Footer */}
      <div className="p-4 border-t border-[#D6E4F0] bg-[#F8FBFF]">
        <div className="text-[11px] font-semibold text-[#164B78]">
          {mode === 'demo' ? 'Active Mode: Demo Simulation' : 'Active Mode: Real IoT Hardware'}
        </div>
        <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed">
          {mode === 'demo'
            ? 'Sample data is clearly marked as simulated for demonstration.'
            : 'Displaying verified ESP32 hardware telemetry and readings only.'}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block shrink-0 no-print">{content}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="fixed inset-0 bg-[#164B78]/25" onClick={onCloseMobile} />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
