import { MotorcycleMakesDocument } from '@motolearn/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ChevronRight, Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './config';

const POPULAR_MAKES = [
  'Honda',
  'Yamaha',
  'Kawasaki',
  'Harley-Davidson',
  'Suzuki',
  'BMW',
  'Ducati',
  'KTM',
];

export default function BikeMakeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setBikeData = useOnboardingStore((s) => s.setBikeData);
  const existingBikeData = useOnboardingStore((s) => s.bikeData);

  const [search, setSearch] = useState('');
  const [selectedMake, setSelectedMake] = useState<{
    makeId: number;
    makeName: string;
  } | null>(
    existingBikeData?.make && existingBikeData?.makeId
      ? { makeId: existingBikeData.makeId, makeName: existingBikeData.make }
      : null,
  );

  const makesResult = useQuery({
    queryKey: queryKeys.nhtsa.makes,
    queryFn: () => gqlFetcher(MotorcycleMakesDocument),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const makes = makesResult.data?.motorcycleMakes ?? [];

  const popularMakeItems = makes.filter((m: { makeName: string }) =>
    POPULAR_MAKES.some((p) => p.toLowerCase() === m.makeName.toLowerCase()),
  );

  const filteredMakes =
    search.length > 0
      ? makes.filter((make: { makeName: string }) =>
          make.makeName.toLowerCase().includes(search.toLowerCase()),
        )
      : [];

  const handleSelectMake = (make: { makeId: number; makeName: string }) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedMake(make);
    setSearch('');
  };

  const handleContinue = () => {
    if (!selectedMake || !existingBikeData) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setBikeData({
      ...existingBikeData,
      make: selectedMake.makeName,
      makeId: selectedMake.makeId,
    });
    router.replace('/(onboarding)/bike-model');
  };

  const showDropdown = search.length > 0 && filteredMakes.length > 0;
  const showNoResults = search.length > 0 && filteredMakes.length === 0 && !makesResult.isLoading;
  const showPopular = !search && !selectedMake && popularMakeItems.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <OnboardingProgress screenIndex={3} totalScreens={TOTAL_SCREENS} />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48 }}>
        <Animated.Text
          entering={FadeInDown.duration(300)}
          style={{
            fontSize: 36,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginBottom: 12,
          }}
        >
          {t('onboarding.bikeMakeTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(100).duration(300)}
          style={{
            fontSize: 17,
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 24,
            marginBottom: 32,
          }}
        >
          {t('onboarding.bikeMakeSubtitle')}
        </Animated.Text>

        {/* Selected make chip */}
        {selectedMake && !search ? (
          <Animated.View entering={FadeInUp.delay(150).duration(300)}>
            <Pressable
              onPress={() => {
                setSelectedMake(null);
                setSearch(selectedMake.makeName);
              }}
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: '#818CF8',
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 16,
                marginBottom: 24,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 17, color: '#FFFFFF', fontWeight: '600' }}>
                {selectedMake.makeName}
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                {t('onboarding.tapToChange')}
              </Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp.delay(200).duration(300)}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <Search size={18} color="rgba(255,255,255,0.4)" />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {t('onboarding.searchMake')}
              </Text>
            </View>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('onboarding.searchMake')}
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoFocus
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.10)',
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 16,
                fontSize: 17,
                color: '#FFFFFF',
                marginBottom: 12,
              }}
            />
          </Animated.View>
        )}

        {/* Loading */}
        {makesResult.isLoading && (
          <ActivityIndicator color="#818CF8" style={{ marginVertical: 20 }} />
        )}

        {/* Error with retry */}
        {makesResult.isError && (
          <View style={{ alignItems: 'center', marginVertical: 20, gap: 12 }}>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>
              {t('onboarding.makesLoadError')}
            </Text>
            <Pressable
              onPress={() => makesResult.refetch()}
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 12,
                borderCurve: 'continuous',
                paddingHorizontal: 20,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#818CF8' }}>
                {t('common.retry')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Search results dropdown */}
        {showDropdown && (
          <Animated.View entering={FadeInUp.duration(200)}>
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
                borderRadius: 16,
                borderCurve: 'continuous',
                maxHeight: 300,
                overflow: 'hidden',
              }}
            >
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {filteredMakes.slice(0, 20).map((make) => (
                  <Pressable
                    key={make.makeId}
                    onPress={() => handleSelectMake(make)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(255,255,255,0.06)',
                      backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'transparent',
                    })}
                  >
                    <Text style={{ fontSize: 16, color: '#FFFFFF' }}>{make.makeName}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Animated.View>
        )}

        {/* No results */}
        {showNoResults && (
          <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
            {t('onboarding.noMakesFound')}
          </Text>
        )}

        {/* Popular makes */}
        {showPopular && !makesResult.isLoading && (
          <Animated.View entering={FadeInUp.delay(250).duration(300)}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 12,
              }}
            >
              {t('onboarding.popularMakes')}
            </Text>
            <View style={{ gap: 8 }}>
              {popularMakeItems.map((make, index) => (
                <Animated.View
                  key={make.makeId}
                  entering={FadeInUp.delay(300 + index * 50).duration(250)}
                >
                  <Pressable
                    onPress={() => handleSelectMake(make)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed
                        ? 'rgba(255,255,255,0.10)'
                        : 'rgba(255,255,255,0.06)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.10)',
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    })}
                  >
                    <Text style={{ fontSize: 16, color: '#FFFFFF', fontWeight: '500' }}>
                      {make.makeName}
                    </Text>
                    <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}
      </View>

      {/* Continue button */}
      {selectedMake && (
        <View style={{ paddingHorizontal: 24, paddingBottom: 48 }}>
          <Animated.View entering={FadeInUp.duration(250)}>
            <Pressable
              onPress={handleContinue}
              style={({ pressed }) => ({
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                borderCurve: 'continuous',
                paddingVertical: 16,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              })}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#0F172A' }}>
                {t('onboarding.continue')}
              </Text>
              <ChevronRight size={20} color="#0F172A" />
            </Pressable>
          </Animated.View>
        </View>
      )}
    </View>
  );
}
