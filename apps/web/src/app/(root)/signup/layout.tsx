import { AuthIntlLayout } from '@/components/auth-ui/auth-intl-layout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthIntlLayout>{children}</AuthIntlLayout>;
}
