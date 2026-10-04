import type { LucideIcon } from 'lucide-react'
import {
  House, LayoutDashboard, FolderGit2, ListFilter, Workflow, Rocket,
  Bug, FileText, ClipboardCheck, Zap, Server, Layers, Plug, Activity,
  FileWarning, BarChart3, ShieldCheck, Scale, ScrollText, Building2,
  Boxes, BookOpen, Settings, Users, Gauge, CreditCard
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  description?: string
  keywords?: string[]
  badge?: string
}

export interface NavSection {
  key: string
  label: string
  icon?: LucideIcon
  items: NavItem[]
}

// Core primary navigation items for everyday workflows
export const NAV_PRIMARY: NavItem[] = [
  { label: 'Overview', to: '/dashboard', icon: House, description: 'Release readiness & workspace overview', keywords: ['home', 'dashboard', 'summary', 'overview'] },
  { label: 'Projects', to: '/projects', icon: FolderGit2, description: 'Connected repositories & services', keywords: ['repositories', 'repos', 'apps', 'services'] },
  { label: 'Runs', to: '/runs', icon: ListFilter, description: 'Analysis & validation runs history', keywords: ['jobs', 'executions', 'history', 'builds', 'analysis'] },
  { label: 'Pipelines', to: '/pipeline', icon: Workflow, description: 'Release orchestration pipelines', keywords: ['workflows', 'ci', 'cd', 'stages', 'automation'] },
  { label: 'Deployments', to: '/deployments', icon: Rocket, description: 'Active and past releases', keywords: ['release', 'publish', 'rollout', 'targets'] },
  { label: 'Findings', to: '/findings', icon: Bug, description: 'Security, bug & quality issues', keywords: ['bugs', 'vulnerabilities', 'issues', 'risks', 'cve'] },
  { label: 'Change Management', to: '/change-management', icon: FileText, description: 'Change requests & risk analysis', keywords: ['cr', 'rfc', 'tickets', 'changes'] },
  { label: 'Approvals', to: '/approvals', icon: ClipboardCheck, description: 'Pending gatekeeper sign-offs', keywords: ['gates', 'reviews', 'signoff', 'decisions'] },
]

// Secondary / Deep capability items
export const NAV_MORE: NavItem[] = [
  { label: 'Analytics', to: '/analytics', icon: Activity, description: 'Engineering & release telemetry', keywords: ['metrics', 'charts', 'telemetry', 'stats', 'dora'] },
  { label: 'Executive View', to: '/executive', icon: BarChart3, description: 'Leadership KPI dashboard', keywords: ['leadership', 'portfolio', 'exec', 'health'] },
  { label: 'Simulator', to: '/simulator', icon: Zap, description: 'Pre-flight release blast radius simulation', keywords: ['blast radius', 'dry run', 'what if', 'preview'] },
  { label: 'Server Validation', to: '/server-validation', icon: Server, description: 'Infrastructure & server verification', keywords: ['servers', 'infra', 'nodes', 'hosts'] },
  { label: 'Environment Validation', to: '/environment', icon: Server, description: 'Stage & production readiness checks', keywords: ['env', 'staging', 'production', 'drift'] },
  { label: 'Stacks', to: '/stacks', icon: Layers, description: 'Multi-service dependency stacks', keywords: ['topology', 'services', 'architecture'] },
  { label: 'Policy Studio', to: '/policies', icon: ShieldCheck, description: 'Governance & compliance rules', keywords: ['rules', 'guardrails', 'checks', 'policy'] },
  { label: 'Compliance', to: '/compliance', icon: Scale, description: 'Regulatory frameworks & reports', keywords: ['soc2', 'hipaa', 'gdpr', 'standards'] },
  { label: 'Incidents', to: '/incidents', icon: FileWarning, description: 'Active disruptions & postmortems', keywords: ['outages', 'alerts', 'sev1', 'oncall'] },
  { label: 'Integrations', to: '/integrations', icon: Plug, description: 'Connected tools & webhooks', keywords: ['github', 'slack', 'jira', 'datadog', 'gitlab'] },
  { label: 'Plugins', to: '/plugins', icon: Boxes, description: 'Custom extensions and marketplace', keywords: ['extensions', 'addons', 'marketplace'] },
  { label: 'Audit Log', to: '/audit', icon: ScrollText, description: 'Immutable action trail', keywords: ['history', 'security log', 'compliance log'] },
  { label: 'Documentation', to: '/docs', icon: BookOpen, description: 'Guides, API reference & specs', keywords: ['help', 'manual', 'api docs', 'guide'] },
]

// Account & Organization management items
export const NAV_ACCOUNT: NavItem[] = [
  { label: 'Settings', to: '/settings', icon: Settings, description: 'Account & workspace preferences', keywords: ['profile', 'config', 'preferences'] },
  { label: 'Organizations', to: '/organizations', icon: Building2, description: 'Manage organizations', keywords: ['org', 'company', 'enterprise'] },
  { label: 'Workspaces', to: '/workspaces', icon: Building2, description: 'All team workspaces', keywords: ['spaces', 'groups', 'teams'] },
  { label: 'Team & Members', to: '/team', icon: Users, description: 'Role-based access & invites', keywords: ['members', 'roles', 'permissions', 'users', 'rbac'] },
  { label: 'Usage & Quotas', to: '/usage', icon: Gauge, description: 'Compute, run minutes & storage', keywords: ['limits', 'consumption', 'metrics', 'quota'] },
  { label: 'Plans & Billing', to: '/plans', icon: CreditCard, description: 'Subscription & invoices', keywords: ['upgrade', 'pricing', 'subscription', 'invoice', 'payment'] },
]

// Extra routes accessible through search or direct navigation
export const NAV_SEARCH_EXTRA: NavItem[] = [
  { label: 'API Testing', to: '/api-testing', icon: Plug, description: 'Automated contract & endpoint testing', keywords: ['api', 'rest', 'endpoints', 'contract'] },
  { label: 'Load Testing', to: '/load-testing', icon: Activity, description: 'Stress testing & capacity validation', keywords: ['performance', 'stress', 'throughput', 'load'] },
  { label: 'Chaos Engineering', to: '/chaos', icon: Zap, description: 'Fault injection & resilience simulations', keywords: ['resilience', 'fault', 'failure', 'chaos'] },
]

// Grouped sections for structured layouts or drawers
export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'core',
    label: 'Platform',
    icon: Boxes,
    items: [
      NAV_PRIMARY[0], // Overview
      NAV_PRIMARY[1], // Projects
      NAV_PRIMARY[2], // Runs
      { label: 'Workspaces', to: '/workspaces', icon: Building2 },
      { label: 'Stacks', to: '/stacks', icon: Layers },
    ]
  },
  {
    key: 'delivery',
    label: 'Delivery & Testing',
    icon: Rocket,
    items: [
      NAV_PRIMARY[3], // Pipelines
      NAV_PRIMARY[4], // Deployments
      { label: 'Simulator', to: '/simulator', icon: Zap },
      { label: 'Server Validation', to: '/server-validation', icon: Server },
      { label: 'Environment Validation', to: '/environment', icon: Server },
    ]
  },
  {
    key: 'operations',
    label: 'Operations & Insights',
    icon: Activity,
    items: [
      NAV_PRIMARY[5], // Findings
      { label: 'Analytics', to: '/analytics', icon: Activity },
      { label: 'Executive View', to: '/executive', icon: BarChart3 },
      { label: 'Incidents', to: '/incidents', icon: FileWarning },
    ]
  },
  {
    key: 'governance',
    label: 'Governance & Security',
    icon: ShieldCheck,
    items: [
      NAV_PRIMARY[6], // Change Management
      NAV_PRIMARY[7], // Approvals
      { label: 'Policy Studio', to: '/policies', icon: ShieldCheck },
      { label: 'Compliance', to: '/compliance', icon: Scale },
      { label: 'Audit Log', to: '/audit', icon: ScrollText },
    ]
  },
  {
    key: 'ecosystem',
    label: 'Ecosystem & Docs',
    icon: Plug,
    items: [
      { label: 'Integrations', to: '/integrations', icon: Plug },
      { label: 'Plugins', to: '/plugins', icon: Boxes },
      { label: 'Documentation', to: '/docs', icon: BookOpen },
    ]
  }
]

// Flat lookup for all navigable items
export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_PRIMARY,
  ...NAV_MORE,
  ...NAV_ACCOUNT,
  ...NAV_SEARCH_EXTRA,
].filter((item, index, self) => index === self.findIndex((t) => t.to === item.to))

// Route -> Human-readable Page Title
export const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/projects': 'Projects',
  '/runs': 'Runs',
  '/pipeline': 'Release Pipelines',
  '/deployments': 'Deployments',
  '/simulator': 'Deployment Simulator',
  '/findings': 'Findings & Issues',
  '/change-management': 'Change Management',
  '/approvals': 'Approvals',
  '/analytics': 'Analytics',
  '/executive': 'Executive View',
  '/server-validation': 'Server Validation',
  '/environment': 'Environment Validation',
  '/stacks': 'Stacks',
  '/policies': 'Policy Studio',
  '/compliance': 'Compliance',
  '/incidents': 'Incidents',
  '/integrations': 'Integrations',
  '/plugins': 'Plugins',
  '/audit': 'Audit Log',
  '/workspaces': 'Workspaces',
  '/organizations': 'Organizations',
  '/team': 'Team & Members',
  '/usage': 'Usage & Quotas',
  '/plans': 'Plans & Pricing',
  '/settings': 'Settings',
  '/docs': 'Documentation',
  '/api-testing': 'API Testing',
  '/load-testing': 'Load Testing',
  '/chaos': 'Chaos Engineering',
}

// Nav filter matching helper
export function navMatches(item: NavItem, query: string): boolean {
  if (!query || !query.trim()) return true
  const q = query.toLowerCase().trim()
  if (item.label.toLowerCase().includes(q)) return true
  if (item.to.toLowerCase().includes(q)) return true
  if (item.description && item.description.toLowerCase().includes(q)) return true
  if (item.keywords && item.keywords.some((k) => k.toLowerCase().includes(q))) return true
  return false
}
