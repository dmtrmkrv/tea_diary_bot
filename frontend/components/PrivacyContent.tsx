import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PRIVACY_POLICY_MD } from '@/lib/privacyPolicy';

// Оформление элементов Markdown под токены приложения. Берём только нужные
// поля (children/href), чтобы не пробрасывать служебный node на DOM-теги.
const components: Components = {
  h4: ({ children }) => (
    <h2 className="mt-2 mb-1 text-[17px] font-semibold text-foreground">{children}</h2>
  ),
  h5: ({ children }) => (
    <h3 className="mt-7 mb-2 text-[15px] font-semibold text-foreground">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-[14px] leading-[22px] text-foreground">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 text-[14px] leading-[21px] text-foreground">
      {children}
    </ul>
  ),
  li: ({ children }) => <li className="marker:text-muted-foreground">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded bg-surface-sunken px-1 py-0.5 text-[13px] text-muted-foreground">
      {children}
    </code>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-default underline underline-offset-2"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-6 border-border-default" />,
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border-default bg-surface-sunken p-2 text-left font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border-default p-2 align-top text-foreground">{children}</td>
  ),
};

export default function PrivacyContent() {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {PRIVACY_POLICY_MD}
    </Markdown>
  );
}
