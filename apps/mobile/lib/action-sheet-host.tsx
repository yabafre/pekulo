// apps/mobile/lib/action-sheet-host.tsx
// Story 10-6 AC-3 — Android row action menus. `Alert.alert` renders at most
// three buttons on Android, so `showActions` (lib/actions.ts) routes Android
// menus here: a module-level store holds the pending request and
// <ActionSheetHost /> (mounted once, Android only, in app/_layout.tsx) renders
// it as a Pekulo DS bottom sheet (`PekuloDrawer` native → @tamagui/sheet)
// listing every action + « Annuler ». iOS keeps `ActionSheetIOS`.
//
// Review fixes (story 10-6 review):
//   - the hardware back button closes the menu (the Tamagui sheet does not
//     listen to it, so back used to pop the screen underneath);
//   - the action list scrolls inside `PekuloDrawer.ScrollView` (a plain RN
//     ScrollView loses its drags to the sheet's pan responder);
//   - the last request stays rendered while the sheet animates closed.

import { PekuloDrawer } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { BackHandler, Pressable } from "react-native";

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
        testID={`${testID}-label`}
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
  const open = request !== null;
  // Keep the last request on screen while the sheet slides down.
  const lastRequest = useRef<ActionSheetRequest | null>(null);
  if (request) lastRequest.current = request;
  const shown = request ?? lastRequest.current;

  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeActionSheet();
      return true;
    });
    return () => subscription.remove();
  }, [open]);

  return (
    <PekuloDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) closeActionSheet();
      }}
    >
      <PekuloDrawer.Portal>
        <PekuloDrawer.Content testID="action-sheet">
          {shown ? (
            <>
              <PekuloDrawer.Header>
                <PekuloDrawer.Title>{shown.title}</PekuloDrawer.Title>
                {shown.message ? (
                  <PekuloDrawer.Description>{shown.message}</PekuloDrawer.Description>
                ) : null}
              </PekuloDrawer.Header>
              <PekuloDrawer.ScrollView keyboardShouldPersistTaps="handled">
                <View gap="$1">
                  {shown.actions.map((action, index) => (
                    <ActionRow
                      // Labels can repeat (two accounts with the same name) and a
                      // request's list is never reordered: position is the identity.
                      // oxlint-disable-next-line react/no-array-index-key
                      key={`${index}:${action.label}`}
                      label={action.label}
                      destructive={action.destructive}
                      testID={`action-sheet-item-${index}`}
                      onPress={() => {
                        if (!open) return;
                        closeActionSheet();
                        action.onPress();
                      }}
                    />
                  ))}
                </View>
              </PekuloDrawer.ScrollView>
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
