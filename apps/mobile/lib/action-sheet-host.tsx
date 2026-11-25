// apps/mobile/lib/action-sheet-host.tsx
// Story 10-6 AC-3 — Android row action menus. `Alert.alert` renders at most
// three buttons on Android, so `showActions` (lib/actions.ts) routes Android
// menus here: a module-level store holds the pending request and
// <ActionSheetHost /> (mounted once, Android only, in app/_layout.tsx) renders
// it as a Pekulo DS bottom sheet (`PekuloDrawer` native → @tamagui/sheet)
// listing every action + « Annuler ». iOS keeps `ActionSheetIOS`.

import { PekuloDrawer } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useSyncExternalStore } from "react";
import { Pressable, ScrollView } from "react-native";

import { tNow } from "./i18n";

export interface ActionSheetItem {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

export interface ActionSheetRequest {
  title: string;
  message?: string;
  actions: ActionSheetItem[];
}

type Listener = () => void;

let current: ActionSheetRequest | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function openActionSheet(request: ActionSheetRequest) {
  current = request;
  emit();
}

export function closeActionSheet() {
  current = null;
  emit();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return current;
}

/** One 48dp Material touch target per action; destructive actions in `$danger`. */
function ActionRow({
  label,
  destructive = false,
  onPress,
  testID,
}: {
  label: string;
  destructive?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        justifyContent: "center",
        paddingHorizontal: 8,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        color={destructive ? "$danger" : "$color"}
        fontSize="$body"
        fontWeight={destructive ? "500" : "400"}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ActionSheetHost() {
  const request = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return (
    <PekuloDrawer
      open={request !== null}
      onOpenChange={(next) => {
        if (!next) closeActionSheet();
      }}
    >
      <PekuloDrawer.Portal>
        <PekuloDrawer.Content testID="action-sheet">
          {request ? (
            <>
              <PekuloDrawer.Header>
                <PekuloDrawer.Title>{request.title}</PekuloDrawer.Title>
                {request.message ? (
                  <PekuloDrawer.Description>{request.message}</PekuloDrawer.Description>
                ) : null}
              </PekuloDrawer.Header>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View gap="$1">
                  {request.actions.map((action, index) => (
                    <ActionRow
                      key={action.label}
                      label={action.label}
                      destructive={action.destructive}
                      testID={`action-sheet-item-${index}`}
                      onPress={() => {
                        closeActionSheet();
                        action.onPress();
                      }}
                    />
                  ))}
                </View>
              </ScrollView>
              <ActionRow
                label={tNow("common.actions.cancel")}
                testID="action-sheet-cancel"
                onPress={closeActionSheet}
              />
            </>
          ) : null}
        </PekuloDrawer.Content>
      </PekuloDrawer.Portal>
    </PekuloDrawer>
  );
}
