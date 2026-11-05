import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User,
  Palette,
  Cpu,
  BarChart3,
  Shield,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader } from '../components/layout/PageHeader';
import { AccountSettings } from '../components/settings/AccountSettings';
import { AppearanceSettings } from '../components/settings/AppearanceSettings';
import { AIProviderSettings } from '../components/settings/AIProviderSettings';
import { UsagePlanSettings } from '../components/settings/UsagePlanSettings';
import { SecuritySettings } from '../components/settings/SecuritySettings';

export type SettingsTabId = 'account' | 'appearance' | 'providers' | 'usage' | 'security';

interface TabItem {
  id: SettingsTabId;
  label: string;
  icon: any;
  description: string;
}

const SETTINGS_TABS: TabItem[] = [
  {
    id: 'account',
    label: 'Account',
    icon: User,
    description: 'Profile identity & study targets',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Palette,
    description: 'Theme & interface preferences',
  },
  {
    id: 'providers',
    label: 'AI & Providers',
    icon: Cpu,
    description: 'Active model engine & BYOK vault',
  },
  {
    id: 'usage',
    label: 'Usage & Plan',
    icon: BarChart3,
    description: 'Resource consumption & plan upgrades',
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    description: 'Session, password & danger zone',
  },
];

export function SettingsView() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize active tab from query parameter or default to 'account'
  const tabParam = searchParams.get('tab') as SettingsTabId | null;
  const initialTab: SettingsTabId =
    tabParam && SETTINGS_TABS.some((t) => t.id === tabParam) ? tabParam : 'account';

  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  useEffect(() => {
    if (tabParam && SETTINGS_TABS.some((t) => t.id === tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  const handleSelectTab = (tabId: SettingsTabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const currentTabMeta = SETTINGS_TABS.find((t) => t.id === activeTab) || SETTINGS_TABS[0];

  return (
    <div className="w-full flex-1 bg-background flex flex-col p-4 md:p-8">
      <div className="max-w-[1050px] mx-auto flex flex-col w-full min-h-0 gap-6">
        {/* Standard Page Header */}
        <PageHeader
          title="Settings"
          description="Configure your account identity, AI engine, BYOK credentials, usage limits, and security controls"
          badge={
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-surface-container border border-border-default text-on-surface-variant rounded-md shadow-2xs">
              Section: {currentTabMeta.label}
            </span>
          }
        />

        {/* Navigation Tabs */}
        <nav
          role="tablist"
          aria-label="Settings sections"
          className="flex gap-2.5 shrink-0 overflow-x-auto pb-2 custom-scrollbar"
        >
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => handleSelectTab(tab.id)}
                className={cn(
                  "px-4 py-2.5 font-black uppercase text-xs rounded-xl border-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-2",
                  isSelected
                    ? "bg-primary text-on-primary border-primary shadow-neo-sm -translate-x-0.5 -translate-y-0.5"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border-border-default"
                )}
              >
                <Icon size={14} className={isSelected ? 'text-on-primary' : 'text-primary'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Tab Content Container */}
        <main className="flex-1 min-h-0">
          {activeTab === 'account' && <AccountSettings />}
          {activeTab === 'appearance' && <AppearanceSettings />}
          {activeTab === 'providers' && <AIProviderSettings />}
          {activeTab === 'usage' && <UsagePlanSettings />}
          {activeTab === 'security' && <SecuritySettings />}
        </main>
      </div>
    </div>
  );
}
