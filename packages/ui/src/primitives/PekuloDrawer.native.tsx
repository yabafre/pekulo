// packages/ui/src/primitives/PekuloDrawer.native.tsx
import { Sheet as TamaSheet } from "@tamagui/sheet";
import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Text, View, styled, type TextProps, type ViewProps } from "tamagui";

interface DrawerContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);
const InsideSheetContext = createContext(false);

const DrawerAction = styled(View, {
  name: "PekuloDrawerAction",
  role: "button",
});

export interface PekuloDrawerProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

function Root({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: PekuloDrawerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );
  const value = useMemo(() => ({ open, setOpen }), [open, setOpen]);

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

type DrawerActionProps = Omit<ViewProps, "children"> & {
  asChild?: boolean;
  children?: ReactNode;
};

function Trigger({ asChild, children, onPress, ...props }: DrawerActionProps) {
  const ctx = useContext(DrawerContext);
  const handlePress = (event: Parameters<NonNullable<ViewProps["onPress"]>>[0]) => {
    onPress?.(event);
    ctx?.setOpen(true);
  };

  if (asChild && isValidElement<{ onPress?: ViewProps["onPress"] }>(children)) {
    const childOnPress = children.props.onPress;
    return cloneElement(children as ReactElement<{ onPress?: ViewProps["onPress"] }>, {
      onPress: (event) => {
        childOnPress?.(event);
        handlePress(event);
      },
    });
  }

  return (
    <DrawerAction {...props} onPress={handlePress}>
      {children}
    </DrawerAction>
  );
}

function Portal({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

function Close({ asChild, children, onPress, ...props }: DrawerActionProps) {
  const ctx = useContext(DrawerContext);
  const handlePress = (event: Parameters<NonNullable<ViewProps["onPress"]>>[0]) => {
    onPress?.(event);
    ctx?.setOpen(false);
  };

  if (asChild && isValidElement<{ onPress?: ViewProps["onPress"] }>(children)) {
    const childOnPress = children.props.onPress;
    return cloneElement(children as ReactElement<{ onPress?: ViewProps["onPress"] }>, {
      onPress: (event) => {
        childOnPress?.(event);
        handlePress(event);
      },
    });
  }

  return (
    <DrawerAction {...props} onPress={handlePress}>
      {children}
    </DrawerAction>
  );
}

function Overlay(props: ViewProps) {
  const insideSheet = useContext(InsideSheetContext);
  if (!insideSheet) return null;
  return <TamaSheet.Overlay backgroundColor="$backgroundOverlay" {...props} />;
}

function Content({ children, ...props }: Omit<ViewProps, "children"> & { children?: ReactNode }) {
  const ctx = useContext(DrawerContext);
  const open = ctx?.open ?? false;

  return (
    <TamaSheet
      modal
      open={open}
      onOpenChange={(next: boolean) => ctx?.setOpen(next)}
      snapPoints={[80, 45]}
      dismissOnSnapToBottom
    >
      <InsideSheetContext.Provider value={true}>
        <Overlay />
        <TamaSheet.Frame
          backgroundColor="$backgroundElevated"
          borderTopLeftRadius={16}
          borderTopRightRadius={16}
          padding="$4"
          gap="$3"
          {...props}
        >
          <DrawerContext.Provider value={ctx}>
            <TamaSheet.Handle
              backgroundColor="$backgroundMuted"
              height={4}
              width={64}
              borderRadius="$full"
              alignSelf="center"
              marginBottom="$2"
            />
            {children}
          </DrawerContext.Provider>
        </TamaSheet.Frame>
      </InsideSheetContext.Provider>
    </TamaSheet>
  );
}

function Header({ children, ...props }: Omit<ViewProps, "children"> & { children?: ReactNode }) {
  return (
    <View flexDirection="column" gap="$1" padding="$2" {...props}>
      {children}
    </View>
  );
}

function Footer({ children, ...props }: Omit<ViewProps, "children"> & { children?: ReactNode }) {
  return (
    <View flexDirection="column" gap="$2" padding="$2" marginTop="auto" {...props}>
      {children}
    </View>
  );
}

function Title(props: TextProps) {
  return <Text fontSize="$body" fontWeight="500" color="$color" {...props} />;
}

function Description(props: TextProps) {
  return <Text fontSize="$bodySm" color="$colorTertiary" {...props} />;
}

export const PekuloDrawer = Object.assign(Root, {
  Trigger,
  Portal,
  Close,
  Overlay,
  Content,
  Header,
  Footer,
  Title,
  Description,
});
