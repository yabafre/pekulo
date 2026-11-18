// packages/ui/src/components/TransactionLogo/TransactionLogo.native.tsx
import { useEffect, useState } from "react";
import { Image } from "react-native";
import { View } from "tamagui";
import { CategoryIcon } from "../CategoryIcon/CategoryIcon.native";

export interface TransactionLogoProps {
  src?: string | null;
  category: string;
  size?: number;
}

function isSafeLogoUri(uri: string | null | undefined): uri is string {
  if (!uri) return false;
  if (uri.startsWith("https://")) return true;
  if (
    typeof __DEV__ !== "undefined" &&
    __DEV__ &&
    (uri.startsWith("http://localhost") || uri.startsWith("http://127.0.0.1"))
  ) {
    return true;
  }
  return false;
}

export function TransactionLogo({ src, category, size = 28 }: TransactionLogoProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const safeSrc = isSafeLogoUri(src) ? src : null;
  const showImg = Boolean(safeSrc) && !failed;

  return (
    <View
      width={size}
      height={size}
      borderRadius="$full"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      backgroundColor="$backgroundMuted"
      accessibilityElementsHidden
    >
      {showImg && safeSrc ? (
        <Image
          source={{ uri: safeSrc }}
          style={{ width: size, height: size }}
          resizeMode="contain"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <CategoryIcon category={category} size={Math.round(size * 0.6)} />
      )}
    </View>
  );
}
