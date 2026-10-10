import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  ArrowUpRight,
  Bookmark,
  BookOpen,
  CreditCard,
  Crown,
  FileText,
  HelpCircle,
  LogOut,
  Map as MapRoute,
  Megaphone,
  Navigation,
  Pencil,
  RotateCcw,
  Settings,
  Shield,
  Smartphone,
  Ticket,
  Trash2,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LEGAL_URL } from '@/components/profile/constants';
import { IdentityHeader } from '@/components/profile/identity-header';
import {
  openManageSubscription,
  restorePurchases,
} from '@/components/profile/subscription-actions';
import {
  ESectionFooter,
  ESectionLabel,
  ESettingsGroup,
  ESettingsRow,
} from '@/components/ui/editorial';
import { PROFILE_ROUTE } from '@/config/routes';
import { useProGate } from '@/hooks/use-pro-gate';
import { useProfileData } from '@/hooks/use-profile-data';
import {
  CODE_REDEMPTION_SURFACE,
  presentCodeRedemption,
  presentPaywall,
} from '@/lib/subscription';
import { useEditorialTheme } from '@/theme/editorial';
import { GUTTER, readableWidth, space } from '@/theme/type';

const IS_IOS = process.env.EXPO_OS === 'ios';
const TAB_BAR_CLEARANCE = 120;

/** One labelled inset group; staggered in once on mount. */
function Section({
  label,
  index,
  children,
}: {
  label: string;
  index: number;
  children: ReactNode;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(250)}>
      <ESectionLabel label={label} />
      <ESettingsGroup>{children}</ESettingsGroup>
    </Animated.View>
  );
}

const ExternalIcon = () => {
  const { t } = useEditorialTheme();
  return <ArrowUpRight size={17} color={t.ink4} strokeWidth={2} />;
};

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const { isPro } = useProGate();

  const { user, handleLogout, handleDeleteAccount, isDeleting } = useProfileData({ t, isPro });
  const appVersion = Constants.expoConfig?.version ?? '';

  return (
    <ScrollView
      testID="profile-screen"
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{
        ...readableWidth,
        paddingTop: insets.top + space.md,
        paddingHorizontal: GUTTER,
        paddingBottom: TAB_BAR_CLEARANCE,
        gap: space.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      <IdentityHeader user={user} isPro={isPro} />

      <Section index={0} label={t('profile.sectionRiding')}>
        <ESettingsRow
          testID="profile-rides"
          icon={Navigation}
          title={t('profile.myRidesTitle')}
          subtitle={t('profile.myRidesDescription')}
          onPress={() => router.push(PROFILE_ROUTE.RIDES)}
        />
        <ESettingsRow
          testID="profile-trips"
          icon={MapRoute}
          title={t('profile.myTripsTitle')}
          onPress={() => router.push(PROFILE_ROUTE.TRIPS)}
        />
        <ESettingsRow
          testID="profile-saved"
          icon={Bookmark}
          title={t('saved.title')}
          onPress={() => router.push(PROFILE_ROUTE.SAVED)}
        />
        {/* CarPlay is Apple-only — the native module isn't linked on Android. */}
        {IS_IOS ? (
          <ESettingsRow
            testID="profile-carplay"
            icon={Smartphone}
            title={t('carplay.entryLabel')}
            onPress={() => router.push('/(modals)/carplay')}
          />
        ) : null}
      </Section>

      <Section index={1} label={t('profile.sectionSubscription')}>
        {isPro ? (
          <ESettingsRow
            testID="profile-pro-status"
            icon={Crown}
            title={t('profile.proActive')}
            subtitle={t('profile.proActiveDesc')}
          />
        ) : (
          <ESettingsRow
            testID="profile-upgrade"
            icon={Crown}
            title={t('profile.proBanner')}
            subtitle={t('profile.proDescription')}
            onPress={() =>
              presentPaywall({
                source: 'profile',
                feature: 'subscription',
                surface: 'profile_subscriptions_row',
              })
            }
          />
        )}
        {isPro ? (
          <ESettingsRow
            testID="profile-manage-subscription"
            icon={CreditCard}
            title={t('profile.manageSubscription')}
            chevron={false}
            accessory={<ExternalIcon />}
            onPress={() => void openManageSubscription(t)}
          />
        ) : null}
        <ESettingsRow
          testID="profile-restore-purchases"
          icon={RotateCcw}
          title={t('profile.restorePurchases')}
          chevron={false}
          onPress={() => void restorePurchases(t)}
        />
        {/* Offer codes from social posts (one per platform) are redeemed here. */}
        {isPro ? null : (
          <ESettingsRow
            testID="profile-redeem-code"
            icon={Ticket}
            title={t('profile.redeemCode')}
            chevron={false}
            onPress={() => void presentCodeRedemption(CODE_REDEMPTION_SURFACE.PROFILE)}
          />
        )}
      </Section>

      <Section index={2} label={t('profile.sectionApp')}>
        <ESettingsRow
          testID="profile-app-settings"
          icon={Settings}
          title={t('profile.appSettings')}
          subtitle={t('profile.appSettingsSubtitle')}
          onPress={() => router.push(PROFILE_ROUTE.APP_SETTINGS)}
        />
        <ESettingsRow
          testID="profile-whats-new"
          icon={Megaphone}
          title={t('whatsNew.badge')}
          onPress={() => router.push('/(modals)/whats-new')}
        />
        {/* Learn is a hidden tab; this is its only entry for riders with a bike. */}
        <ESettingsRow
          testID="profile-learn"
          icon={BookOpen}
          title={t('tabs.learn')}
          onPress={() => router.push('/(tabs)/(learn)')}
        />
      </Section>

      <Section index={3} label={t('profile.support')}>
        <ESettingsRow
          testID="profile-help"
          icon={HelpCircle}
          title={t('profile.helpFaq')}
          onPress={() => router.push(PROFILE_ROUTE.SUPPORT)}
        />
        <ESettingsRow
          testID="profile-terms"
          icon={FileText}
          title={t('profile.terms')}
          chevron={false}
          accessory={<ExternalIcon />}
          onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URL.TERMS)}
        />
        <ESettingsRow
          testID="profile-privacy-policy"
          icon={Shield}
          title={t('profile.privacyPolicy')}
          chevron={false}
          accessory={<ExternalIcon />}
          onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URL.PRIVACY)}
        />
      </Section>

      <View>
        <Section index={4} label={t('profile.sectionAccount')}>
          <ESettingsRow
            testID="profile-edit"
            icon={Pencil}
            title={t('profile.editProfile')}
            onPress={() => router.push(PROFILE_ROUTE.EDIT_PROFILE)}
          />
          <ESettingsRow
            testID="profile-sign-out"
            icon={LogOut}
            title={t('auth.signOut')}
            destructive
            onPress={handleLogout}
          />
          <ESettingsRow
            testID="profile-delete-account"
            icon={Trash2}
            title={t('privacy.deleteAccount')}
            destructive
            loading={isDeleting}
            onPress={handleDeleteAccount}
          />
        </Section>
        {appVersion ? (
          <ESectionFooter>{`MotoVault · ${t('support.version', { version: appVersion })}`}</ESectionFooter>
        ) : null}
      </View>
    </ScrollView>
  );
}
