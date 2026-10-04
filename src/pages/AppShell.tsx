// @ts-nocheck
import { useEffect, useMemo, useState, type ReactNode, createContext, useContext } from 'react'
import {
  Bug, Building2, Check, ChevronRight, ChevronsUpDown,
  FolderGit2, Layers, LogOut, Menu, Pin, Plus,
  Server, Sparkles, X, Sun, Moon, Settings as SettingsIcon, Users, CreditCard,
  Gauge, ShieldCheck, FileText, ClipboardCheck, Zap, Activity, FileWarning,
  Workflow, Rocket, Boxes, BookOpen, ScrollText, Plug, BarChart3, Command
} from 'lucide-react'
import { supabase, type Workspace, type Organization, type WorkspacePlan, type PlanId, PLANS } from '../lib/supabase'
import { usePins, removePin, pinKey, type PinType } from '../lib/pins'
import {
  NAV_ACCOUNT, NAV_PRIMARY, PAGE_TITLES, type NavItem
} from '../lib/nav'
import { useRouter, Link } from '../lib/router'
import { useAuth } from '../lib/auth'
import { CommandPalette } from './CommandPalette'
import { AskAiPanel } from './AskAiPanel'

export const PlanContext = createContext<PlanId>('free')
export function usePlanId(): PlanId { return useContext(PlanContext) }

const PIN_ICONS: Record<PinType, any> = {
  workspace: Building2,
  project: FolderGit2,
  finding: Bug,
  stack: Layers,
  environment: Server,
}

// Grouped sections for structured, clean secondary navigation
const SECONDARY_SECTIONS = [
  {
    id: 'operations',
    title: 'Operations & Testing',
    icon: Activity,
    items: [
      { label: 'Analytics', to: '/analytics', icon: Activity, description: 'Release & telemetry metrics' },
      { label: 'Executive View', to: '/executive', icon: BarChart3, description: 'Leadership KPIs' },
      { label: 'Simulator', to: '/simulator', icon: Zap, description: 'Release blast-radius simulation' },
      { label: 'Server Validation', to: '/server-validation', icon: Server, description: 'Server infrastructure checks' },
      { label: 'Environment Validation', to: '/environment', icon: Server, description: 'Stage & prod readiness' },
      { label: 'Incidents', to: '/incidents', icon: FileWarning, description: 'Incident response' },
    ]
  },
  {
    id: 'governance',
    title: 'Governance & Security',
    icon: ShieldCheck,
    items: [
      { label: 'Policy Studio', to: '/policies', icon: ShieldCheck, description: 'Release guardrails' },
      { label: 'Compliance', to: '/compliance', icon: ShieldCheck, description: 'Frameworks & standards' },
      { label: 'Audit Log', to: '/audit', icon: ScrollText, description: 'Audit trails & logs' },
    ]
  },
  {
    id: 'ecosystem',
    title: 'Ecosystem & Tools',
    icon: Boxes,
    items: [
      { label: 'Stacks', to: '/stacks', icon: Layers, description: 'Service architectures' },
      { label: 'Integrations', to: '/integrations', icon: Plug, description: 'GitHub, Slack, webhooks' },
      { label: 'Plugins', to: '/plugins', icon: Boxes, description: 'Extensions marketplace' },
    ]
  }
]

const CSS = `
:root {
  --lh-bg: #f8f9fc;
  --lh-surface: #ffffff;
  --lh-surface2: #f3f4f8;
  --lh-surface-hover: #eaeef6;
  --lh-sidebar: #ffffff;
  --lh-sidebar-border: #e8ebf0;
  --lh-border: #e8ebf0;
  --lh-border2: #d3d7e0;
  --lh-text: #101828;
  --lh-text2: #475467;
  --lh-text3: #98a2b3;
  --lh-accent: #6366f1;
  --lh-accent-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  --lh-accent-weak: #eef2ff;
  --lh-accent-contrast: #ffffff;
  --lh-ring: rgba(99, 102, 241, 0.2);
  --lh-dropdown-bg: #ffffff;
  --lh-dropdown-shadow: 0 20px 48px -10px rgba(16, 24, 40, 0.16), 0 1px 3px 0 rgba(16, 24, 40, 0.06);
}

:root[data-theme="dark"] {
  --lh-bg: #0b0d14;
  --lh-surface: #121520;
  --lh-surface2: #1a1e2d;
  --lh-surface-hover: #22283a;
  --lh-sidebar: #0e111a;
  --lh-sidebar-border: #1a1e2d;
  --lh-border: #1a1e2d;
  --lh-border2: #2a3147;
  --lh-text: #f9fafb;
  --lh-text2: #94a3b8;
  --lh-text3: #64748b;
  --lh-accent: #818cf8;
  --lh-accent-gradient: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%);
  --lh-accent-weak: rgba(129, 140, 248, 0.15);
  --lh-accent-contrast: #ffffff;
  --lh-ring: rgba(129, 140, 248, 0.28);
  --lh-dropdown-bg: #141824;
  --lh-dropdown-shadow: 0 24px 60px -8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.lh-app {
  min-height: 100vh;
  background: var(--lh-bg);
  color: var(--lh-text);
  font-family: inherit;
}

:root[data-theme="light"] .lh-app {
  background:
    radial-gradient(900px 500px at 15% -5%, rgba(99, 102, 241, 0.07), transparent 70%),
    radial-gradient(850px 450px at 90% 5%, rgba(139, 92, 246, 0.05), transparent 65%),
    #f8f9fc;
  background-attachment: fixed;
}

:root[data-theme="dark"] .lh-app {
  background:
    radial-gradient(900px 500px at 15% -5%, rgba(129, 140, 248, 0.08), transparent 70%),
    radial-gradient(850px 450px at 90% 5%, rgba(167, 139, 250, 0.05), transparent 65%),
    #0b0d14;
  background-attachment: fixed;
}

/* Sidebar Core Layout */
.lh-sb {
  background: var(--lh-sidebar);
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid var(--lh-sidebar-border);
  position: relative;
  user-select: none;
}

/* Brand Header */
.lh-brand-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 14px 14px 16px;
}

.lh-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 16.5px;
  letter-spacing: -0.02em;
  color: var(--lh-text);
  text-decoration: none;
}

.lh-mk {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--lh-accent-gradient);
  display: grid;
  place-items: center;
  color: #ffffff;
  box-shadow: 0 2px 8px -1px rgba(99, 102, 241, 0.4);
  flex-shrink: 0;
}

.lh-brand-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--lh-surface2);
  color: var(--lh-accent);
}

/* Workspace Selector Trigger Card */
.lh-wswrap {
  position: relative;
  margin: 0 12px 10px;
}

.lh-ws {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 0;
  border-radius: 12px;
  background: var(--lh-surface2);
  color: var(--lh-text);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.lh-ws:hover, .lh-ws.open {
  background: var(--lh-surface-hover);
}

.lh-ws .wa {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--lh-accent-gradient);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 12px;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
}

.lh-ws-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.lh-ws .wn {
  font-weight: 600;
  font-size: 13px;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lh-ws-orgname {
  font-size: 11px;
  color: var(--lh-text3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}

.lh-ws-chev {
  color: var(--lh-text3);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}

.lh-ws.open .lh-ws-chev {
  transform: rotate(180deg);
  color: var(--lh-accent);
}

/* Borderless Modern Dropdown Popovers with Side Margins */
.lh-wsm-ov {
  position: fixed;
  inset: 0;
  z-index: 55;
}

.lh-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 8px;
  right: 8px;
  z-index: 60;
  background: var(--lh-dropdown-bg);
  border: 0;
  border-radius: 16px;
  box-shadow: var(--lh-dropdown-shadow);
  padding: 8px;
  max-height: min(78vh, 520px);
  overflow-y: auto;
  animation: lh-pop-in 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}

.lh-popover.up {
  top: auto;
  bottom: calc(100% + 10px);
  left: 8px;
  right: 8px;
}

@keyframes lh-pop-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.lh-pop-card {
  padding: 10px 12px;
  background: var(--lh-surface2);
  border-radius: 12px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.lh-pop-sec-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lh-text3);
  padding: 8px 10px 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lh-pop-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 0;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--lh-text);
  text-align: left;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.12s ease, color 0.12s ease;
}

.lh-pop-item:hover {
  background: var(--lh-surface2);
}

.lh-pop-item.active {
  background: var(--lh-accent-weak);
  color: var(--lh-accent);
  font-weight: 600;
}

.lh-pop-item .nm {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lh-pop-item.action-create {
  color: var(--lh-accent);
  font-weight: 600;
}

.lh-pop-item.action-danger {
  color: #ef4444;
}

.lh-pop-item.action-danger:hover {
  background: rgba(239, 68, 68, 0.12);
}

.lh-pop-divider {
  height: 1px;
  background: var(--lh-surface2);
  margin: 6px 4px;
}

/* Dark Mode Switch inside Profile Dropdown */
.lh-theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 10px;
  color: var(--lh-text);
  font-size: 13px;
  font-weight: 500;
  transition: background 0.12s ease;
  cursor: pointer;
}

.lh-theme-row:hover {
  background: var(--lh-surface2);
}

.lh-theme-info {
  display: flex;
  align-items: center;
  gap: 9px;
}

.lh-switch {
  width: 40px;
  height: 22px;
  border-radius: 12px;
  background: var(--lh-surface2);
  border: 0;
  position: relative;
  cursor: pointer;
  padding: 2px;
  transition: background 0.2s ease;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

:root[data-theme="light"] .lh-switch {
  background: #e2e4ea;
}

.lh-switch.active {
  background: var(--lh-accent);
}

.lh-switch-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform: translateX(0);
}

.lh-switch.active .lh-switch-thumb {
  transform: translateX(18px);
}

/* Navigation Scroll Area */
.lh-nav {
  flex: 1;
  overflow-y: auto;
  padding: 4px 10px 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--lh-border) transparent;
  display: flex;
  flex-direction: column;
}

.lh-nav::-webkit-scrollbar {
  width: 4px;
}
.lh-nav::-webkit-scrollbar-thumb {
  background: var(--lh-surface2);
  border-radius: 4px;
}

.lh-nav-content {
  flex: 1;
}

.lh-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--lh-text2);
  font-weight: 500;
  text-decoration: none;
  border: 0;
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  margin-bottom: 2px;
  transition: all 0.12s ease;
  position: relative;
}

.lh-item:hover {
  background: var(--lh-surface2);
  color: var(--lh-text);
}

.lh-item.active {
  background: var(--lh-accent-weak);
  color: var(--lh-accent);
  font-weight: 600;
}

.lh-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 7px;
  bottom: 7px;
  width: 3px;
  border-radius: 0 4px 4px 0;
  background: var(--lh-accent);
}

.lh-item-badge {
  margin-left: auto;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--lh-surface2);
  color: var(--lh-text3);
}

/* Sections & Accordions */
.lh-sec-hdr {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--lh-text3);
  padding: 12px 10px 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lh-grp {
  margin-bottom: 3px;
}

.lh-sec-btn {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--lh-text3);
  cursor: pointer;
  text-align: left;
  transition: all 0.12s ease;
}

.lh-sec-btn:hover {
  background: var(--lh-surface2);
  color: var(--lh-text2);
}

.lh-sec-btn.open, .lh-sec-btn.has-active {
  color: var(--lh-text);
}

.lh-sec-btn.has-active {
  font-weight: 700;
}

.lh-sec-btn .gl {
  flex: 1;
}

.lh-sec-btn .cv {
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
  color: var(--lh-text3);
}

.lh-sec-btn.open .cv {
  transform: rotate(90deg);
  color: var(--lh-text);
}

.lh-sec-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lh-accent);
  margin-right: 4px;
}

.lh-grp-items {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.lh-grp-items.open {
  grid-template-rows: 1fr;
}

.lh-grp-items-inner {
  overflow: hidden;
  min-height: 0;
  margin: 2px 0 4px 14px;
  padding-left: 8px;
  border-left: 1px solid var(--lh-sidebar-border);
  display: flex;
  flex-direction: column;
}

.lh-grp-items-inner .lh-item {
  font-size: 12.5px;
  padding: 7px 8px;
}

/* Bottom Documentation Dock */
.lh-nav-bottom {
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--lh-sidebar-border);
}

/* Pinned Items */
.lh-pinrow .lh-pinlabel {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lh-unpin {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: var(--lh-text3);
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 3px;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.12s ease;
}

.lh-item:hover .lh-unpin {
  opacity: 1;
}

.lh-unpin:hover {
  background: var(--lh-surface-hover);
  color: var(--lh-text);
}

/* Footer & User Profile Button */
.lh-foot {
  position: relative;
  border-top: 1px solid var(--lh-sidebar-border);
  padding: 10px 12px;
  background: var(--lh-sidebar);
}

.lh-userbtn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  padding: 7px 8px;
  border-radius: 12px;
  cursor: pointer;
  color: inherit;
  text-align: left;
  transition: all 0.15s ease;
}

.lh-userbtn:hover, .lh-userbtn.open {
  background: var(--lh-surface2);
}

.lh-ua-wrap {
  position: relative;
  flex-shrink: 0;
}

.lh-ua {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--lh-accent-gradient);
  color: #fff;
  display: grid;
  place-items: center;
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
}

.lh-ua-online {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #10b981;
  border: 2px solid var(--lh-sidebar);
}

.lh-un {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.25;
}

.lh-ue {
  font-size: 11px;
  color: var(--lh-text3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}

.lh-user-chev {
  color: var(--lh-text3);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}

.lh-userbtn.open .lh-user-chev {
  transform: rotate(180deg);
  color: var(--lh-accent);
}

/* Header & Shell */
.lh-tb {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 24px;
  border-bottom: 1px solid var(--lh-border);
  background: color-mix(in srgb, var(--lh-bg) 88%, transparent);
  backdrop-filter: blur(12px);
}

.lh-title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.lh-plan-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 4px 6px 4px 10px;
  border-radius: 20px;
  border: 1px solid var(--lh-border);
  background: var(--lh-surface);
  color: var(--lh-text2);
  text-decoration: none;
}

.lh-plan-badge .up {
  font-size: 10px;
  text-transform: none;
  background: var(--lh-accent);
  color: #fff;
  padding: 2px 7px;
  border-radius: 12px;
}

.lh-plan-badge.enterprise .up {
  display: none;
}

@media (max-width: 820px) {
  .lh-plan-badge {
    display: none;
  }
}

.lh-search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 260px;
  padding: 7px 11px;
  border: 1px solid var(--lh-border);
  border-radius: 10px;
  background: var(--lh-surface);
  color: var(--lh-text3);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.lh-search:hover {
  border-color: var(--lh-accent);
  color: var(--lh-text2);
}

.lh-kbd {
  margin-left: auto;
  font-size: 11px;
  border: 1px solid var(--lh-border);
  border-radius: 5px;
  padding: 1px 5px;
}

@media (max-width: 767px) {
  .lh-search {
    display: none;
  }
}

.lh-iconbtn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--lh-border);
  background: var(--lh-surface);
  color: var(--lh-text2);
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.lh-iconbtn:hover {
  background: var(--lh-surface2);
  color: var(--lh-text);
  border-color: var(--lh-border2);
}

.lh-mobile-menu {
  display: none;
}

@media (max-width: 1023px) {
  .lh-mobile-menu {
    display: grid;
  }
}

.lh-shell-body {
  position: relative;
  z-index: 1;
}

.lh-ai {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 60;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 18px;
  border-radius: 30px;
  background: var(--lh-accent-gradient);
  color: #fff;
  border: 0;
  cursor: pointer;
  font-weight: 600;
  font-size: 13.5px;
  box-shadow: 0 8px 24px -4px rgba(99, 102, 241, 0.4);
  transition: all 0.2s ease;
}

.lh-ai:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px -4px rgba(99, 102, 241, 0.55);
}

/* Modals */
.lh-orgov {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.lh-orgm {
  width: min(94vw, 440px);
  background: var(--lh-surface);
  border: 1px solid var(--lh-border);
  border-radius: 18px;
  padding: 24px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
}

.lh-orgm h3 {
  font-size: 17px;
  font-weight: 700;
  margin: 0;
}

.lh-orgm p {
  font-size: 13px;
  color: var(--lh-text3);
  margin: 6px 0 0;
}

.lh-orgm input {
  width: 100%;
  margin-top: 16px;
  background: var(--lh-surface2);
  border: 1px solid var(--lh-border);
  border-radius: 10px;
  padding: 10px 13px;
  font-size: 14px;
  color: var(--lh-text);
  outline: none;
}

.lh-orgm input:focus {
  border-color: var(--lh-accent);
  box-shadow: 0 0 0 3px var(--lh-ring);
}

.lh-orgm .row {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  justify-content: flex-end;
}

.lh-orgm .b {
  border-radius: 10px;
  padding: 9px 16px;
  border: 1px solid var(--lh-border);
  background: transparent;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--lh-text2);
  cursor: pointer;
  transition: all 0.15s ease;
}

.lh-orgm .b:hover {
  background: var(--lh-surface2);
  color: var(--lh-text);
}

.lh-orgm .b.pri {
  background: var(--lh-accent-gradient);
  color: #fff;
  border: 0;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.lh-orgm .b.pri:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`

function Brand() {
  return (
    <div className="lh-brand-wrap">
      <Link to="/dashboard" className="lh-brand">
        <span className="lh-mk">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M12 2l5 6M12 2L7 8"/>
            <circle cx="12" cy="16" r="2.5" fill="currentColor"/>
          </svg>
        </span>
        <span>LytHouse</span>
      </Link>
      <span className="lh-brand-badge">App</span>
    </div>
  )
}

function isPathActive(path: string, to: string) {
  return path === to || path.startsWith(to + '/')
}

export function AppShell({ children }: { children: ReactNode }) {
  const { path, navigate } = useRouter()
  const { user, profile, signOut } = useAuth()
  const [activeWs, setActiveWs] = useState<Workspace | null>(null)
  const [wsList, setWsList] = useState<Workspace[]>([])
  const [orgList, setOrgList] = useState<Organization[]>([])
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null)
  const [wsMenuOpen, setWsMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [modal, setModal] = useState<null | 'org' | 'ws'>(null)
  const [modalName, setModalName] = useState('')
  const [modalBusy, setModalBusy] = useState(false)
  const [plan, setPlan] = useState<WorkspacePlan | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  // Manage open secondary sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    SECONDARY_SECTIONS.forEach(sec => {
      if (sec.items.some(i => isPathActive(path, i.to))) {
        initial[sec.id] = true
      }
    })
    return initial
  })

  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('lh.theme') as any) || 'light')
  const pins = usePins()

  // Auto-expand section when navigated into
  useEffect(() => {
    SECONDARY_SECTIONS.forEach(sec => {
      if (sec.items.some(i => isPathActive(path, i.to))) {
        setOpenSections(prev => ({ ...prev, [sec.id]: true }))
      }
    })
  }, [path])

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(v => !v)
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('lh.theme', theme)
  }, [theme])

  useEffect(() => {
    ;(async () => {
      let orgs: Organization[] = []
      try {
        const { data } = await supabase.from('organizations').select('*').order('created_at')
        orgs = data || []
      } catch {}
      let cur: Organization | null = null
      if (orgs.length) {
        setOrgList(orgs)
        const saved = localStorage.getItem('sandbox.activeOrg')
        cur = orgs.find(o => o.id === saved) ?? orgs[0]
        setActiveOrg(cur)
        localStorage.setItem('sandbox.activeOrg', cur.id)
      }
      const { data: ws } = await supabase.from('workspaces').select('*').order('created_at')
      if (!ws?.length) return
      setWsList(ws)
      const list = cur ? (ws.filter(w => !w.organization_id || w.organization_id === cur.id) || ws) : ws
      const active = list.find(w => w.id === localStorage.getItem('sandbox.activeWs')) ?? list[0]
      setActiveWs(active)
      localStorage.setItem('sandbox.activeWs', active.id)
    })()
  }, [])

  useEffect(() => {
    if (activeWs) {
      supabase.from('workspace_plans').select('*').eq('workspace_id', activeWs.id).order('created_at', { ascending: false }).limit(1)
        .then(({ data }) => data?.[0] && setPlan(data[0]))
    }
  }, [activeWs])

  const planId = (plan?.plan_id as PlanId) ?? 'free'
  const planInfo = PLANS[planId] || { name: 'Free Plan' }
  const pageTitle = PAGE_TITLES[Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length).find(k => isPathActive(path, k)) || ''] || 'LytHouse'

  const go = () => {
    setMobileOpen(false)
  }

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const orgWorkspaces = useMemo(
    () => activeOrg ? wsList.filter(w => !w.organization_id || w.organization_id === activeOrg.id) : wsList,
    [wsList, activeOrg],
  )

  const createEntity = async () => {
    const name = modalName.trim()
    if (!name) return
    setModalBusy(true)
    if (modal === 'org') {
      const { data, error } = await supabase.rpc('create_organization_with_workspace', { p_name: name, p_description: null })
      const created = Array.isArray(data) ? data[0] : data
      if (!error && created) {
        localStorage.setItem('sandbox.activeOrg', String(created.organization_id))
        localStorage.setItem('sandbox.activeWs', String(created.workspace_id))
        window.location.assign('/dashboard')
      }
    } else {
      const orgId = activeOrg?.id || orgList[0]?.id
      if (!orgId) { setModalBusy(false); return }
      const { data, error } = await supabase.rpc('create_workspace', { p_organization_id: orgId, p_name: name, p_description: null })
      if (!error && data) {
        localStorage.setItem('sandbox.activeOrg', orgId)
        localStorage.setItem('sandbox.activeWs', String(data))
        window.location.assign(`/workspaces/${data}`)
      }
    }
    setModalBusy(false)
  }

  // Directly switch and open that workspace's page to inspect and update details
  const switchWorkspace = (w: Workspace) => {
    if (w.organization_id) localStorage.setItem('sandbox.activeOrg', w.organization_id)
    localStorage.setItem('sandbox.activeWs', w.id)
    window.location.assign(`/workspaces/${w.id}`)
  }

  // Directly switch and open that organization's page to inspect and update details
  const switchOrg = (o: Organization) => {
    localStorage.setItem('sandbox.activeOrg', o.id)
    localStorage.removeItem('sandbox.activeWs')
    window.location.assign('/organizations')
  }

  const NavItemRow = ({ item, size = 16 }: { item: NavItem; size?: number }) => {
    const active = isPathActive(path, item.to)
    const Icon = item.icon
    return (
      <Link
        to={item.to}
        onClick={go}
        className={`lh-item ${active ? 'active' : ''}`}
        title={item.description || item.label}
      >
        <Icon size={size} strokeWidth={active ? 2.2 : 1.8} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.label}
        </span>
        {item.badge && <span className="lh-item-badge">{item.badge}</span>}
      </Link>
    )
  }

  const Sidebar = (
    <div className="lh-sb">
      <Brand />

      {/* Workspace Switcher Card */}
      <div className="lh-wswrap">
        <button
          type="button"
          className={`lh-ws ${wsMenuOpen ? 'open' : ''}`}
          aria-haspopup="menu"
          aria-expanded={wsMenuOpen}
          onClick={() => { setUserMenuOpen(false); setWsMenuOpen(v => !v) }}
        >
          <span className="wa">{(activeWs?.name || activeOrg?.name || 'W')[0].toUpperCase()}</span>
          <span className="lh-ws-meta">
            <span className="wn">{activeWs?.name || 'My Workspace'}</span>
            <span className="lh-ws-orgname">{activeOrg?.name || 'Organization'}</span>
          </span>
          <ChevronsUpDown size={15} className="lh-ws-chev" />
        </button>

        {wsMenuOpen && (
          <>
            <div className="lh-wsm-ov" onClick={() => setWsMenuOpen(false)} />
            <div className="lh-popover" role="menu">
              {/* Workspaces Section */}
              <div className="lh-pop-sec-title">
                <span>Workspaces</span>
                <span>{orgWorkspaces.length}</span>
              </div>
              {orgWorkspaces.map(w => {
                const isCurrent = activeWs?.id === w.id
                return (
                  <button
                    key={w.id}
                    className={`lh-pop-item ${isCurrent ? 'active' : ''}`}
                    onClick={() => { setWsMenuOpen(false); switchWorkspace(w) }}
                    title={`Click to open ${w.name} details & settings`}
                  >
                    <Building2 size={14} />
                    <span className="nm">{w.name}</span>
                    {isCurrent && <Check size={14} style={{ color: 'var(--lh-accent)' }} />}
                  </button>
                )
              })}

              <button
                className="lh-pop-item action-create"
                onClick={() => { setWsMenuOpen(false); setModalName(''); setModal('ws') }}
              >
                <Plus size={14} />
                <span className="nm">Create new workspace</span>
              </button>

              <div className="lh-pop-divider" />

              {/* Organization Section */}
              <div className="lh-pop-sec-title">
                <span>Organizations</span>
                <span>{orgList.length}</span>
              </div>
              {orgList.map(o => {
                const isCurrentOrg = activeOrg?.id === o.id
                return (
                  <button
                    key={o.id}
                    className={`lh-pop-item ${isCurrentOrg ? 'active' : ''}`}
                    onClick={() => { setWsMenuOpen(false); switchOrg(o) }}
                    title={`Click to open ${o.name} details & settings`}
                  >
                    <Building2 size={14} />
                    <span className="nm">{o.name}</span>
                    {isCurrentOrg && <Check size={14} style={{ color: 'var(--lh-accent)' }} />}
                  </button>
                )
              })}

              <button
                className="lh-pop-item action-create"
                onClick={() => { setWsMenuOpen(false); setModalName(''); setModal('org') }}
              >
                <Plus size={14} />
                <span className="nm">Create new organization</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Navigation Links Area */}
      <nav className="lh-nav">
        <div className="lh-nav-content">
          {/* Primary Everyday Actions */}
          <div className="lh-sec-hdr">Core Platform</div>
          {NAV_PRIMARY.map(i => <NavItemRow key={i.to} item={i} size={16} />)}

          {/* Pinned Items Section */}
          {pins.length > 0 && (
            <div className="lh-grp" style={{ marginTop: 8 }}>
              <div className="lh-sec-hdr">
                <span>Pinned</span>
                <Pin size={11} />
              </div>
              {pins.map(p => {
                const I = PIN_ICONS[p.type] || FolderGit2
                return (
                  <Link key={pinKey(p.type, p.id)} to={p.to} onClick={go} className="lh-item lh-pinrow">
                    <I size={15} />
                    <span className="lh-pinlabel">{p.label}</span>
                    <button
                      className="lh-unpin"
                      aria-label={`Unpin ${p.label}`}
                      onClick={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        removePin(p.type, p.id)
                      }}
                    >
                      <X size={12} />
                    </button>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Expandable Grouped Sections for Deep Features */}
          <div style={{ marginTop: 8 }}>
            <div className="lh-sec-hdr">Capabilities</div>
            {SECONDARY_SECTIONS.map(section => {
              const isOpen = !!openSections[section.id]
              const hasActive = section.items.some(i => isPathActive(path, i.to))
              const SectionIcon = section.icon
              return (
                <div key={section.id} className="lh-grp">
                  <button
                    type="button"
                    className={`lh-sec-btn ${isOpen ? 'open' : ''} ${hasActive ? 'has-active' : ''}`}
                    onClick={() => toggleSection(section.id)}
                  >
                    {hasActive && <span className="lh-sec-dot" />}
                    <SectionIcon size={15} />
                    <span className="gl">{section.title}</span>
                    <ChevronRight size={14} className="cv" />
                  </button>
                  <div className={`lh-grp-items ${isOpen ? 'open' : ''}`}>
                    <div className="lh-grp-items-inner">
                      {section.items.map(i => <NavItemRow key={i.to} item={i} size={14.5} />)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Resources / Docs Section at Bottom of Nav */}
        <div className="lh-nav-bottom">
          <Link to="/docs" onClick={go} className={`lh-item ${isPathActive(path, '/docs') ? 'active' : ''}`}>
            <BookOpen size={15} />
            <span style={{ flex: 1 }}>Documentation</span>
            <span className="lh-item-badge">v2.4</span>
          </Link>
        </div>
      </nav>

      {/* User Profile Footer & Dropdown */}
      <div className="lh-foot">
        <button
          type="button"
          className={`lh-userbtn ${userMenuOpen ? 'open' : ''}`}
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
          onClick={() => { setWsMenuOpen(false); setUserMenuOpen(v => !v) }}
        >
          <div className="lh-ua-wrap">
            <span className="lh-ua">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (profile?.full_name || user?.email || 'U')[0].toUpperCase()}
            </span>
            <span className="lh-ua-online" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="lh-un">{profile?.full_name || 'My Account'}</div>
            <div className="lh-ue">{user?.email || 'user@lythouse.dev'}</div>
          </div>

          <ChevronsUpDown size={15} className="lh-user-chev" />
        </button>

        {userMenuOpen && (
          <>
            <div className="lh-wsm-ov" onClick={() => setUserMenuOpen(false)} />
            <div className="lh-popover up" role="menu">
              {/* Profile Card Header */}
              <div className="lh-pop-card">
                <div className="lh-ua" style={{ width: 34, height: 34, fontSize: 13 }}>
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (profile?.full_name || user?.email || 'U')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile?.full_name || 'User Profile'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--lh-text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email || ''}
                  </div>
                </div>
                <span className="lh-brand-badge" style={{ textTransform: 'capitalize' }}>
                  {planId}
                </span>
              </div>

              {/* Account Management Links */}
              <div className="lh-pop-sec-title">
                <span>Account & Organization</span>
              </div>
              {NAV_ACCOUNT.map(i => {
                const Icon = i.icon
                return (
                  <Link
                    key={i.to}
                    to={i.to}
                    className="lh-pop-item"
                    onClick={() => { setUserMenuOpen(false); go() }}
                  >
                    <Icon size={14} />
                    <span className="nm">{i.label}</span>
                  </Link>
                )
              })}

              <div className="lh-pop-divider" />

              {/* Interactive Theme Switcher Row */}
              <div className="lh-theme-row" onClick={toggleTheme}>
                <div className="lh-theme-info">
                  {theme === 'dark' ? <Moon size={14} style={{ color: 'var(--lh-accent)' }} /> : <Sun size={14} style={{ color: '#f59e0b' }} />}
                  <span>Dark Mode</span>
                </div>
                <div
                  role="switch"
                  aria-checked={theme === 'dark'}
                  className={`lh-switch ${theme === 'dark' ? 'active' : ''}`}
                >
                  <span className="lh-switch-thumb" />
                </div>
              </div>

              <div className="lh-pop-divider" />

              {/* Sign Out Action */}
              <button
                type="button"
                className="lh-pop-item action-danger"
                onClick={() => { setUserMenuOpen(false); signOut() }}
              >
                <LogOut size={14} />
                <span className="nm">Sign out</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="lh-app">
      <style>{CSS}</style>

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-64 lg:block">
        {Sidebar}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-64 transition-transform duration-200 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {Sidebar}
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64 lh-shell-body">
        <header className="lh-tb">
          <button
            onClick={() => setMobileOpen(true)}
            className="lh-iconbtn lh-mobile-menu"
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <span className="lh-title">{pageTitle}</span>

          <Link to="/plans" className={`lh-plan-badge ${planId}`}>
            {planInfo.name}
            {planId !== 'enterprise' && <span className="up">Upgrade</span>}
          </Link>

          <button type="button" className="lh-search" onClick={() => setPaletteOpen(true)}>
            <Command size={14} />
            <span>Search or jump to…</span>
            <span className="lh-kbd">⌘K</span>
          </button>

          <div style={{ flex: 1 }} />

          <button
            className="lh-iconbtn"
            title="Toggle theme"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8" style={{ color: 'var(--lh-text)' }}>
          <PlanContext.Provider value={planId}>{children}</PlanContext.Provider>
        </main>
      </div>

      {/* Floating Ask AI Button & Panel */}
      <button className="lh-ai" onClick={() => setAiOpen(true)}>
        <Sparkles size={16} />
        <span>Ask AI</span>
      </button>
      <AskAiPanel open={aiOpen} onClose={() => setAiOpen(false)} />

      {/* Create Org / Workspace Modal */}
      {modal && (
        <div className="lh-orgov" onClick={() => !modalBusy && setModal(null)}>
          <div className="lh-orgm" onClick={e => e.stopPropagation()}>
            <h3>{modal === 'org' ? 'Create new organization' : 'Create new workspace'}</h3>
            <p>
              {modal === 'org'
                ? 'Set up a dedicated team environment to manage multiple workspaces, members, and billing.'
                : 'Create an isolated workspace under your organization for specific projects and releases.'}
            </p>
            <input
              autoFocus
              value={modalName}
              onChange={e => setModalName(e.target.value)}
              placeholder={modal === 'org' ? 'e.g. Acme Corporation' : 'e.g. Platform Engineering'}
              onKeyDown={e => {
                if (e.key === 'Enter' && modalName.trim() && !modalBusy) createEntity()
              }}
            />
            <div className="row">
              <button className="b" onClick={() => setModal(null)} disabled={modalBusy}>
                Cancel
              </button>
              <button
                className="b pri"
                onClick={createEntity}
                disabled={modalBusy || !modalName.trim()}
              >
                {modalBusy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App-wide Command Palette Launcher */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSignOut={() => signOut()}
      />
    </div>
  )
}
