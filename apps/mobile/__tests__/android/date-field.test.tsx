// apps/mobile/__tests__/android/date-field.test.tsx
// Story 10-6 review — on Android a mounted <DateTimePicker> is the Material date
// DIALOG itself (`display="compact"` is iOS-only), so every form sheet with a
// date opened a calendar over the form (found by the action-sheet Maestro flow
// on the CI emulator). Android must show the date and open the dialog on tap.
import { PekuloRootProvider } from "@pekulo/ui";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { DateField } from "../../components/form/fields";

const open = DateTimePickerAndroid.open as jest.Mock;
const VALUE = new Date(2026, 10, 26);

async function renderField(onChange = jest.fn()) {
  await render(
    <PekuloRootProvider theme="pekulo-light">
      <DateField label="Date" value={VALUE} onChange={onChange} testID="tx-date" />
    </PekuloRootProvider>,
  );
  return onChange;
}

type AndroidPickerArgs = {
  value: Date;
  mode: string;
  onChange: (event: { type: string }, date?: Date) => void;
};

describe("Android DateField (story 10-6 review)", () => {
  beforeEach(() => open.mockClear());

  it("shows the date without opening the dialog on mount", async () => {
    await renderField();
    expect(open).not.toHaveBeenCalled();
    // The mocked inline picker renders the ISO value; the Android row does not.
    expect(screen.queryByText(VALUE.toISOString())).toBeNull();
    expect(screen.getByText("26 nov. 2026")).toBeTruthy();
  });

  it("opens the Material dialog on tap and applies only a confirmed date", async () => {
    const onChange = await renderField();
    await fireEvent.press(screen.getByTestId("tx-date"));
    expect(open).toHaveBeenCalledTimes(1);
    const args = open.mock.calls[0]?.[0] as AndroidPickerArgs;
    expect(args).toMatchObject({ value: VALUE, mode: "date" });

    args.onChange({ type: "dismissed" });
    expect(onChange).not.toHaveBeenCalled();
    const picked = new Date(2026, 10, 20);
    args.onChange({ type: "set" }, picked);
    expect(onChange).toHaveBeenCalledWith(picked);
  });
});
