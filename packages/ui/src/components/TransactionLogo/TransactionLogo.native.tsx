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

export function TransactionLogo({ src, category, size = 28 }: TransactionLogoProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const showImg = Boolean(src) && !failed;

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
      {showImg && src ? (
        <Image
          source={{ uri: src }}
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
