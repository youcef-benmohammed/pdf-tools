export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--color-brand-600)" />
      <path d="M10 7h8.5L23 11.5V25H10z" fill="#fff" />
      <path d="M18.5 7v4.5H23" fill="#d9d2fb" />
      <rect x="13" y="16" width="7" height="1.6" rx=".8" fill="var(--color-brand-600)" />
      <rect x="13" y="19.5" width="5" height="1.6" rx=".8" fill="var(--color-brand-600)" />
    </svg>
  );
}
