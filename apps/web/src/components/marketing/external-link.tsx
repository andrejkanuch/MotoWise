const HTTP_HREF = /^https?:/i;

/** Opens http(s) links in a new tab; mailto:/tel: stay in place (a blank tab is the browser's only other outcome). */
export function ExternalLink({
  href,
  children,
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const opensTab = typeof href === 'string' && HTTP_HREF.test(href);
  return (
    <a
      href={href}
      target={opensTab ? '_blank' : undefined}
      rel={opensTab ? 'noopener noreferrer' : undefined}
      className={className}
      {...props}
    >
      {children}
    </a>
  );
}
