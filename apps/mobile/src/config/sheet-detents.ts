/**
 * Detents for the form sheets (expense, task, complete task, bike). Their
 * Cancel/Save footer is sticky to the bottom of the sheet's layout. On Android,
 * react-native-screens lays a formSheet out at its largest detent even while it
 * rests on a smaller one, so a lower detent pushed the footer off screen. Android
 * gets a single tall detent; iOS keeps its resting + expanded pair.
 */
const IS_ANDROID = process.env.EXPO_OS === 'android';
const ANDROID_FORM_DETENT = [0.92];

export const FORM_SHEET_DETENTS = {
  EXPENSE: IS_ANDROID ? ANDROID_FORM_DETENT : [0.7, 0.9],
  TASK: IS_ANDROID ? ANDROID_FORM_DETENT : [0.85, 1.0],
  COMPLETE_TASK: IS_ANDROID ? ANDROID_FORM_DETENT : [0.65, 0.85, 1.0],
  /** Add a Bike and Edit Motorcycle: tall forms whose typeahead lists grow under the field. */
  BIKE: IS_ANDROID ? ANDROID_FORM_DETENT : [0.85, 1.0],
} as const;
