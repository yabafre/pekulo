// apps/mobile/components/search-field.tsx
// iOS-style search field rendered in the scroll content (under the Large
// Title). Replaces `Stack.SearchBar`, whose stacked placement mis-insets the
// content and fades the title on iOS 26 when it gains focus. Native TextInput,
// native clear button, and a localized "Annuler" / "Cancel" action while editing.

import { Text, View } from "@pekulo/ui/client";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import { Pressable, TextInput } from "react-native";
import { useTheme } from "tamagui";

import { useI18n } from "../lib/i18n";

export function SearchField({
  value,
  onChange,
  placeholder,
  testID,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  testID?: string;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <View flexDirection="row" alignItems="center" gap="$3">
      <View
        flex={1}
        flexDirection="row"
        alignItems="center"
        gap="$2"
        height={38}
        paddingHorizontal="$3"
        borderRadius={12}
        backgroundColor="$backgroundMuted"
        style={{ borderCurve: "continuous" }}
      >
        <SymbolView
          name="magnifyingglass"
          size={16}
          weight="medium"
          tintColor={theme.colorTertiary.val}
          fallback={null}
        />
        <TextInput
          ref={inputRef}
          testID={testID}
          accessibilityLabel={placeholder}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.colorTertiary.val}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          enterKeyHint="search"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            height: 38,
            fontSize: 17,
            color: theme.color.val,
            fontFamily: "Geist_400Regular",
          }}
        />
      </View>
      {focused || value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("transactions.search.cancelAria")}
          hitSlop={8}
          onPress={() => {
            onChange("");
            inputRef.current?.blur();
          }}
          style={({ pressed }) => ({
            minHeight: 44,
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text color="$color" fontSize="$body">
            {t("common.actions.cancel")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
