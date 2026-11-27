// apps/mobile/__tests__/android/native-fonts.test.tsx
// Story 10-8 AC-3 — Android Jest project (jest-expo/android). Same assertions
// as the iOS project; Android is where fontFamily + fontWeight falls back to Roboto.
import { describeNativeFonts } from "../helpers/native-fonts";

describeNativeFonts("Android");
