// @ts-nocheck
// Public legal / trust pages. Content is a practical starting template tailored
// to LytHouse (a tool that connects to customer source code + infrastructure).
// A banner reminds readers to have counsel review before relying on it.
import { Logo } from '../lib/ui';
import { useRouter } from '../lib/router';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

const COMPANY = 'LytHouse';
const CONTACT = 'support@lythouse.ai';
const UPDATED = 'July 2026';

// Each doc: { title, intro, sections: [{ h, p: string | string[] }] }
const DOCS = {
  terms: {
    title: 'Terms of Service',
    intro: `These terms govern your use of ${COMPANY} ("the Service"). By creating an account or using the Service you agree to them.`,
    sections: [
      { h: '1. The Service', p: `${COMPANY} analyzes software repositories and related configuration to help teams make pre-deployment release decisions. Features, plans and limits may change over time.` },
      { h: '2. Accounts', p: 'You are responsible for your account, your workspace members, and all activity under them. Provide accurate information and keep your credentials secure. You must be authorized to connect any repository or system you link to the Service.' },
      { h: '3. Acceptable use', p: 'You may only connect repositories and systems you own or are authorized to analyze. You may not use the Service to violate any law, infringe rights, or attempt to access data belonging to other customers. See the Acceptable Use Policy.' },
      { h: '4. Plans, billing and cancellation', p: 'Paid plans are billed in advance on a recurring basis via our payment processor. You can cancel at any time; access continues until the end of the paid period. Fees are non-refundable except where required by law or stated in our refund terms.' },
      { h: '5. Your content and data', p: `You retain ownership of your repositories, code, findings and other data. You grant ${COMPANY} the limited rights needed to operate the Service for you (for example, reading a repository to analyze it). We describe how we handle data in the Privacy Policy.` },
      { h: '6. Intellectual property', p: `The Service, including its software and content, is owned by ${COMPANY}. These terms do not grant you rights in the Service beyond the right to use it.` },
      { h: '7. Disclaimers', p: `The Service provides analysis and recommendations to assist human judgment. It is provided "as is" without warranties. ${COMPANY} does not guarantee that a release is safe, secure, or defect-free, and you remain responsible for your deployment decisions.` },
      { h: '8. Limitation of liability', p: `To the extent permitted by law, ${COMPANY} is not liable for indirect or consequential damages, and total liability is limited to the amounts you paid in the 12 months before the claim.` },
      { h: '9. Termination', p: 'Either party may terminate. On termination you can request export or deletion of your data as described in the Data Deletion policy.' },
      { h: '10. Changes and contact', p: `We may update these terms; material changes will be notified. Questions: ${CONTACT}.` },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: `This policy explains what data ${COMPANY} collects, how we use it, and your choices.`,
    sections: [
      { h: 'What we collect', p: ['Account data: name, email, workspace and role.', 'Connected-system data: repository contents, configuration files, and metadata you authorize us to read in order to analyze a release.', 'Usage data: actions in the app, device and log information for security and reliability.', 'Billing data: handled by our payment processor; we do not store full card numbers.'] },
      { h: 'How we use it', p: 'To provide and secure the Service — analyze releases, surface findings, run the features you request, prevent abuse, and support you. We do not sell your data.' },
      { h: 'AI processing', p: 'Some features use AI models to summarize findings and generate recommendations. We do not use your private source code or findings to train third-party foundation models. Where a feature sends content to an AI provider to produce your result, it is used only to serve that request.' },
      { h: 'Source code handling', p: 'We read the minimum needed to analyze a release. We do not create long-term copies of your source beyond what is required to produce and cache your results, and cached results can be cleared. When you disconnect a repository, we stop accessing it and delete stored access tokens.' },
      { h: 'Access tokens', p: 'Integration tokens are stored encrypted and are never returned to the browser. Only the systems that need them to run your jobs can decrypt them.' },
      { h: 'Sharing', p: 'We share data only with subprocessors that help operate the Service (see the Subprocessor list), and when required by law. Your workspace data is isolated from other customers.' },
      { h: 'Retention & deletion', p: `We keep data while your account is active. You can request export or deletion at any time — see the Data Deletion policy or email ${CONTACT}.` },
      { h: 'Your rights', p: 'Depending on your location you may have rights to access, correct, export or delete your personal data. Contact us to exercise them.' },
      { h: 'Contact', p: CONTACT },
    ],
  },
  security: {
    title: 'Security',
    intro: `How ${COMPANY} protects your data and systems.`,
    sections: [
      { h: 'Tenant isolation', p: 'Every workspace is isolated. Access is enforced at the database level (row-level security scoped to workspace membership), so one customer cannot read or modify another customer’s data.' },
      { h: 'Encryption', p: 'Data is encrypted in transit (HTTPS/TLS). Integration access tokens are encrypted at rest and never exposed to the browser.' },
      { h: 'Access control', p: 'Role-based permissions (Owner, Admin, Developer, Approver, Viewer) govern what members can do. Administrative access to production is limited and logged.' },
      { h: 'Least-privilege analysis', p: 'We request read-only scopes where possible and read only what is needed to analyze a release.' },
      { h: 'Isolation of untrusted input', p: 'Analysis of customer repositories runs in constrained environments; we avoid executing untrusted customer code in our main application environment.' },
      { h: 'Monitoring', p: 'We track application errors, authentication failures and payment issues, and maintain an incident-response process.' },
      { h: 'Reporting a vulnerability', p: `Please report security concerns to ${CONTACT}. We investigate promptly and will keep you informed.` },
    ],
  },
  'acceptable-use': {
    title: 'Acceptable Use Policy',
    intro: `Rules for using ${COMPANY} responsibly.`,
    sections: [
      { h: 'Authorized use only', p: 'Only connect repositories, cloud accounts and systems you own or are explicitly authorized to analyze.' },
      { h: 'Prohibited activities', p: ['Attempting to access data belonging to other customers.', 'Reverse-engineering, disrupting, or overloading the Service.', 'Uploading malware or using the Service to develop or distribute it.', 'Violating any applicable law or third-party rights.'] },
      { h: 'Fair use of resources', p: 'Automated or high-volume use must stay within your plan’s limits. We may apply rate limits or per-customer concurrency limits to protect the Service.' },
      { h: 'Enforcement', p: 'We may suspend accounts that violate this policy, with notice where practical.' },
    ],
  },
  cookies: {
    title: 'Cookie Notice',
    intro: `How ${COMPANY} uses cookies and similar technologies.`,
    sections: [
      { h: 'Essential cookies', p: 'Required to sign you in and keep your session secure. The app cannot function without these.' },
      { h: 'Preferences', p: 'Remember choices such as your active workspace. Stored locally in your browser.' },
      { h: 'Analytics', p: 'If enabled, we use privacy-respecting analytics to understand product usage and improve the Service. We do not use advertising cookies.' },
      { h: 'Your choices', p: 'You can clear cookies in your browser settings. Blocking essential cookies will prevent sign-in.' },
    ],
  },
  'data-deletion': {
    title: 'Data Deletion',
    intro: `How to delete your data from ${COMPANY}.`,
    sections: [
      { h: 'Delete specific data', p: 'You can clear cached analysis for a project from its Settings, and remove connected integrations (which deletes their stored tokens) at any time.' },
      { h: 'Delete your account', p: `To delete your account and associated workspace data, use account deletion in Settings or email ${CONTACT}. We remove your data within 30 days, except where retention is legally required.` },
      { h: 'Disconnecting a repository', p: 'When you disconnect a repository, we stop accessing it and delete stored access tokens for it. Cached results tied to it can be cleared.' },
      { h: 'Backups', p: 'Residual copies in encrypted backups are purged on our normal backup rotation.' },
    ],
  },
  subprocessors: {
    title: 'Subprocessors',
    intro: `Third parties ${COMPANY} uses to operate the Service. This list may change; material changes will be notified.`,
    sections: [
      { h: 'Hosting & delivery', p: 'Vercel — application hosting, CDN and TLS.' },
      { h: 'Database & auth', p: 'Supabase — database, authentication and serverless functions.' },
      { h: 'Payments', p: 'Stripe — subscription billing and payment processing.' },
      { h: 'AI processing', p: 'An AI model provider is used to generate summaries and recommendations for features you invoke.' },
      { h: 'Email', p: 'A transactional email provider is used for verification, password reset, and notifications.' },
      { h: 'Note', p: `Exact providers and regions are confirmed at launch. Questions: ${CONTACT}.` },
    ],
  },
};

export const LEGAL_ROUTES = Object.keys(DOCS); // ['terms','privacy',...]

export function LegalPage({ doc }) {
  const { navigate } = useRouter();
  const d = DOCS[doc] || DOCS.terms;
  const Body = ({ p }) => Array.isArray(p)
    ? <ul className="mt-1.5 space-y-1 list-disc pl-5 text-navy-700 text-[15px] leading-relaxed">{p.map((x, i) => <li key={i}>{x}</li>)}</ul>
    : <p className="mt-1.5 text-navy-700 text-[15px] leading-relaxed">{p}</p>;
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-[#a1a1aa]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <button onClick={() => navigate('/')} title="Home"><Logo size={26} /></button>
          <button onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-navy-900 inline-flex items-center gap-1.5"><ArrowLeft size={14} />Home</button>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
            <span>This is a practical starting template, not legal advice. Have it reviewed by counsel before you rely on it for real customers.</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-navy-900">{d.title}</h1>
          <p className="mt-1 text-xs text-gray-400">Last updated {UPDATED}</p>
          <p className="mt-4 text-navy-700 text-[15px] leading-relaxed">{d.intro}</p>
          <div className="mt-8 space-y-6">
            {d.sections.map((s, i) => (
              <section key={i}>
                <h2 className="text-base font-bold text-navy-900">{s.h}</h2>
                <Body p={s.p} />
              </section>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#a1a1aa] pt-6 text-sm">
            {LEGAL_ROUTES.map((r) => (
              <button key={r} onClick={() => navigate('/' + r)} className={`hover:underline ${r === doc ? 'text-navy-900 font-semibold' : 'text-brand-600'}`}>{DOCS[r].title}</button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
export default LegalPage;
