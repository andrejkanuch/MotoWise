import { MotorcycleMakesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ChevronRight, Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useOnboardingStore } from '../../stores/onboarding.store';

const POPULAR_MAKES = ['BMW', 'Ducati', 'KTM', 'Harley-Davidson', 'Honda', 'Yamaha', 'Triumph'];

export default function BikeMakeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setBikeData = useOnboardingStore((s) => s.setBikeData);
  const existingBikeData = useOnboardingStore((s) => s.bikeData);

  const [search, setSearch] = useState('');
  const [customMake, setCustomMake] = useState('');
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
    if ((!selectedMake && !customMake.trim()) || !existingBikeData) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setBikeData({
      ...existingBikeData,
      make: customMake || selectedMake?.makeName || '',
      makeId: customMake ? 0 : (selectedMake?.makeId ?? 0),
    });
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
      step: 'bike_make',
      step_index: 3,
      bike_make: customMake || selectedMake?.makeName || '',
      is_custom_make: !!customMake,
    });
    router.replace('/(onboarding)/bike-model');
  };

  const isValidCustomMake = customMake.trim().length > 0 && !customMake.includes('@');
  const canContinue = !!(selectedMake || isValidCustomMake);
  const showDropdown = search.length > 0 && filteredMakes.length > 0;
  const showNoResults = search.length > 0 && filteredMakes.length === 0 && !makesResult.isLoading;
  const showGrid = !search && !selectedMake && !customMake && popularMakeItems.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 24 }}>
              {/* Progress */}
              <View style={{ flexDirection: 'row', gap: 4, marginBottom: 26 }}>
                {[1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor:
                        i === 1 ? ONBOARDING_COLORS.warm : ONBOARDING_COLORS.surface2,
                    }}
                  />
                ))}
              </View>

              <Animated.View entering={FadeInDown.duration(300)}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: ONBOARDING_COLORS.warm,
                    marginBottom: 10,
                  }}
                >
                  Step 1 of 3
                </Text>
                <Text
                  style={{
                    fontFamily: 'InstrumentSerif-Regular',
                    fontSize: 36,
                    lineHeight: 38,
                    color: ONBOARDING_COLORS.textPrimary,
                    letterSpacing: -0.7,
                    marginBottom: 6,
                  }}
                >
                  What do you ride?
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: ONBOARDING_COLORS.textSecondary,
                    lineHeight: 20,
                  }}
                >
                  Pick your make — we'll pre-fill service intervals, torque specs, and common
                  issues.
                </Text>
              </Animated.View>
            </View>

            {/* Content */}
            <ScrollView
              style={{ flex: 1, paddingTop: 24 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Selected make chip */}
              {selectedMake && !search ? (
                <Animated.View entering={FadeInUp.duration(200)}>
                  <Pressable
                    onPress={() => {
                      setSelectedMake(null);
                      setSearch(selectedMake.makeName);
                    }}
                    style={{
                      backgroundColor: `${ONBOARDING_COLORS.warm}24`,
                      borderWidth: 1,
                      borderColor: ONBOARDING_COLORS.warm,
                      borderRadius: 16,
                      borderCurve: 'continuous',
                      padding: 18,
                      marginBottom: 24,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        borderCurve: 'continuous',
                        backgroundColor: ONBOARDING_COLORS.surface2,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: ONBOARDING_COLORS.textSecondary,
                          letterSpacing: 0.5,
                        }}
                      >
                        {selectedMake.makeName[0]}
                      </Text>
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontWeight: '600',
                        color: ONBOARDING_COLORS.textPrimary,
                        letterSpacing: -0.1,
                      }}
                    >
                      {selectedMake.makeName}
                    </Text>
                    <Text style={{ fontSize: 12, color: ONBOARDING_COLORS.ink3 }}>
                      Tap to change
                    </Text>
                  </Pressable>
                </Animated.View>
              ) : customMake && !search ? (
                <Animated.View entering={FadeInUp.duration(200)}>
                  <Pressable
                    onPress={() => {
                      setSearch(customMake);
                      setCustomMake('');
                    }}
                    style={{
                      backgroundColor: `${ONBOARDING_COLORS.warm}24`,
                      borderWidth: 1,
                      borderColor: ONBOARDING_COLORS.warm,
                      borderRadius: 16,
                      borderCurve: 'continuous',
                      padding: 18,
                      marginBottom: 24,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontWeight: '600',
                        color: ONBOARDING_COLORS.textPrimary,
                      }}
                    >
                      {customMake}
                    </Text>
                    <Text
                      style={{ fontSize: 11, color: ONBOARDING_COLORS.warm, fontWeight: '600' }}
                    >
                      Custom
                    </Text>
                  </Pressable>
                </Animated.View>
              ) : null}

              {/* Search bar (when no selection) */}
              {!selectedMake && !customMake && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: ONBOARDING_COLORS.surface,
                    borderWidth: 1,
                    borderColor: ONBOARDING_COLORS.line,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    paddingHorizontal: 14,
                    marginBottom: 16,
                    gap: 10,
                  }}
                >
                  <Search size={16} color={ONBOARDING_COLORS.ink3} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search makes..."
                    placeholderTextColor={ONBOARDING_COLORS.ink3}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      fontSize: 15,
                      color: ONBOARDING_COLORS.textPrimary,
                    }}
                  />
                </View>
              )}

              {/* Loading */}
              {makesResult.isLoading && (
                <ActivityIndicator color={ONBOARDING_COLORS.warm} style={{ marginVertical: 20 }} />
              )}

              {/* Search results dropdown */}
              {showDropdown && (
                <Animated.View entering={FadeInUp.duration(200)}>
                  <View
                    style={{
                      backgroundColor: ONBOARDING_COLORS.surface,
                      borderWidth: 1,
                      borderColor: ONBOARDING_COLORS.line,
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
                            borderBottomColor: ONBOARDING_COLORS.line,
                            backgroundColor: pressed ? ONBOARDING_COLORS.surface2 : 'transparent',
                          })}
                        >
                          <Text
                            style={{
                              fontSize: 15,
                              color: ONBOARDING_COLORS.textPrimary,
                              fontWeight: '500',
                            }}
                          >
                            {make.makeName}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </Animated.View>
              )}

              {/* No results — custom make */}
              {showNoResults && (
                <Animated.View entering={FadeInUp.duration(200)} style={{ gap: 8 }}>
                  <Text style={{ fontSize: 14, color: ONBOARDING_COLORS.ink3, paddingLeft: 4 }}>
                    No makes found
                  </Text>
                  <Pressable
                    onPress={() => {
                      if (process.env.EXPO_OS === 'ios') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      setCustomMake(search);
                      setSearch('');
                      setSelectedMake(null);
                    }}
                    style={{
                      backgroundColor: ONBOARDING_COLORS.surface,
                      borderWidth: 1,
                      borderColor: ONBOARDING_COLORS.warm,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: ONBOARDING_COLORS.warm,
                        fontWeight: '600',
                        flexShrink: 1,
                      }}
                    >
                      Use "{search}" as make
                    </Text>
                    <ChevronRight size={16} color={ONBOARDING_COLORS.warm} />
                  </Pressable>
                </Animated.View>
              )}

              {/* Popular makes grid — editorial 2-column layout */}
              {showGrid && !makesResult.isLoading && (
                <Animated.View entering={FadeInUp.delay(100).duration(300)}>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    {popularMakeItems.map((make, index) => (
                      <Animated.View
                        key={make.makeId}
                        entering={FadeInUp.delay(150 + index * 50).duration(250)}
                        style={{ width: '48.5%' }}
                      >
                        <Pressable
                          onPress={() => handleSelectMake(make)}
                          style={({ pressed }) => ({
                            padding: 18,
                            borderRadius: 16,
                            borderCurve: 'continuous',
                            backgroundColor: pressed
                              ? ONBOARDING_COLORS.surface2
                              : ONBOARDING_COLORS.surface,
                            borderWidth: 1,
                            borderColor: ONBOARDING_COLORS.line,
                            gap: 10,
                          })}
                        >
                          <View
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              borderCurve: 'continuous',
                              backgroundColor: ONBOARDING_COLORS.surface2,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '700',
                                color: ONBOARDING_COLORS.textSecondary,
                                letterSpacing: 0.5,
                              }}
                            >
                              {make.makeName[0]}
                            </Text>
                          </View>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: '600',
                              color: ONBOARDING_COLORS.textPrimary,
                              letterSpacing: -0.1,
                            }}
                          >
                            {make.makeName}
                          </Text>
                        </Pressable>
                      </Animated.View>
                    ))}
                    {/* + Other card */}
                    <View style={{ width: '48.5%' }}>
                      <Pressable
                        onPress={() => {
                          setSearch('');
                        }}
                        style={{
                          padding: 18,
                          borderRadius: 16,
                          borderCurve: 'continuous',
                          backgroundColor: ONBOARDING_COLORS.surface,
                          borderWidth: 1,
                          borderColor: ONBOARDING_COLORS.line,
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: 88,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            color: ONBOARDING_COLORS.ink3,
                          }}
                        >
                          + Other
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </Animated.View>
              )}
            </ScrollView>

            {/* Bottom CTA */}
            {canContinue && (
              <Animated.View
                entering={FadeInUp.duration(250)}
                style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
              >
                <OnboardingContinueButton
                  label={t('onboarding.continue')}
                  onPress={handleContinue}
                />
              </Animated.View>
            )}
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}
