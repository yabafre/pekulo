# Bento Forms (React Hook Form Integration)

> Premium form components from @tamagui/bento providing production-ready form layouts with comprehensive validation and React Hook Form integration.

## Table of Contents

- [Input System Architecture](#input-system-architecture)
- [React Hook Form Integration](#react-hook-form-integration)
- [Validation with Zod](#validation-with-zod)
- [Form Components](#form-components)
- [Advanced Patterns](#advanced-patterns)
- [Accessibility](#accessibility)
- [Quick Reference](#quick-reference)

---

## Input System Architecture

Bento Forms use a composable input system built on `createStyledContext` for seamless size and color sharing across components.

### Core Components

```typescript
import { Input } from './components/inputsParts'

// Component hierarchy:
Input               // Container with InputContext
  ├─ Input.Label    // Accessible label
  ├─ Input.Box      // XGroup-based input wrapper with focus management
  │    ├─ Input.Section  // Layout section for icons/buttons
  │    ├─ Input.Area     // Actual text input
  │    ├─ Input.Icon     // Themed icon container
  │    └─ Input.Button   // Action button
  └─ Input.Info     // Helper/error text
```

### Context-Based Size Management

The Input system uses `createStyledContext` to share size and styling across all child components:

```typescript
const InputContext = createStyledContext<{
  size: FontSizeTokens
  scaleIcon: number
  color?: ColorTokens | string
}>({
  size: '$true',
  scaleIcon: 1.2,
  color: undefined,
})
```

**Benefits:**
- All nested components automatically inherit size
- Consistent spacing and typography
- Simplified API (set size once on parent)

### Focus State Management

Input.Box manages focus state internally using `FocusContext`:

```typescript
const FocusContext = createStyledContext({
  setFocused: (val: boolean) => {},
  focused: false,
})

const InputGroupImpl = InputGroupFrame.styleable((props, forwardedRef) => {
  const [focused, setFocused] = useState(false)
  
  return (
    <FocusContext.Provider focused={focused} setFocused={setFocused}>
      <InputGroupFrame applyFocusStyle={focused} ref={forwardedRef} {...rest}>
        {children}
      </InputGroupFrame>
    </FocusContext.Provider>
  )
})
```

**Focus Styles:**
```typescript
focusStyle: {
  outlineColor: '$outlineColor',
  outlineWidth: 2,
  outlineStyle: 'solid',
  borderColor: '$borderColorFocus',
}
```

### Basic Input Example

```typescript
<Input size="$4">
  <Input.Label htmlFor="email">Email</Input.Label>
  <Input.Box>
    <Input.Area 
      id="email" 
      placeholder="email@example.com"
    />
  </Input.Box>
</Input>
```

---

## React Hook Form Integration

Bento Forms integrate seamlessly with React Hook Form using the `Controller` component for full form state management.

### Setup

```bash
npm install react-hook-form @hookform/resolvers zod
```

### Basic Pattern

```typescript
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email({ message: 'Invalid email format' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
})

type FormValues = z.infer<typeof schema>

function MyForm() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = (data: FormValues) => {
    console.log(data)
  }

  return (
    <View gap="$4">
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            {...(errors.email && { theme: 'red' })}
            onBlur={onBlur}
            size="$4"
          >
            <Input.Label htmlFor="email">Email</Input.Label>
            <Input.Box>
              <Input.Area
                id="email"
                placeholder="email@example.com"
                onChangeText={onChange}
                value={value}
              />
            </Input.Box>
            {errors.email && (
              <Input.Info theme="red">{errors.email.message}</Input.Info>
            )}
          </Input>
        )}
      />
      
      <Button onPress={handleSubmit(onSubmit)}>Submit</Button>
    </View>
  )
}
```

### Controller Field Props

The `field` object from Controller provides:

```typescript
{
  onChange: (value: string) => void,  // Update form state
  onBlur: () => void,                 // Mark field as touched
  value: string,                      // Current field value
  name: string,                       // Field name
  ref: React.Ref                      // Field reference
}
```

### Input.Area Integration

The Input.Area component handles both web and native change events:

```typescript
<Input.Area
  onChangeText={onChange}  // Normalized API for both platforms
  value={value}
  onBlur={onBlur}
/>

// Internal implementation handles:
// - Web: e.target.value
// - Native: e.nativeEvent.text
```

---

## Validation with Zod

### Schema Definition

```typescript
import { z } from 'zod'

const signupSchema = z.object({
  firstName: z.string().min(1, { message: 'First name is required' }),
  lastName: z.string().min(1, { message: 'Last name is required' }),
  email: z.string().email({ message: 'Invalid email format' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  confirmedPassword: z.string().min(6, { message: 'Confirm password must be at least 6 characters' }),
  postalCode: z.string().min(4, { message: 'Invalid postal code format' }),
  accountType: z.enum(['personal', 'business'], { message: 'Account type is required' }),
}).refine((data) => data.password === data.confirmedPassword, {
  message: 'Passwords do not match',
  path: ['confirmedPassword'],  // Attach error to confirmedPassword field
})
```

### Custom Refinements

Zod's `refine` method allows cross-field validation:

```typescript
.refine(
  (data) => data.password === data.confirmedPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmedPassword'],  // Where to show the error
  }
)
```

### Animated Error Display

```typescript
import { AnimatePresence } from 'tamagui'
import { Info } from '@tamagui/lucide-icons'

<Input
  {...(errors.firstName && { theme: 'red' })}
  size="$4"
>
  <Input.Label>First Name</Input.Label>
  <Input.Box>
    <Input.Area 
      placeholder="First name"
      onChangeText={onChange}
      value={value}
    />
  </Input.Box>
  
  <AnimatePresence>
    {errors.firstName && (
      <View
        position="absolute"
        b="$-5"
        l={0}
        gap="$2"
        flexDirection="row"
        transition="bouncy"
        scaleY={1}
        enterStyle={{
          opacity: 0,
          y: -10,
          scaleY: 0.5,
        }}
        exitStyle={{
          opacity: 0,
          y: -10,
          scaleY: 0.5,
        }}
      >
        <Input.Icon p={0}>
          <Info />
        </Input.Icon>
        <Input.Info>{errors.firstName.message}</Input.Info>
      </View>
    )}
  </AnimatePresence>
</Input>
```

**Key Animation Properties:**
- `transition="bouncy"` - Smooth spring animation
- `scaleY={1}` - Full height when visible
- `enterStyle` - Animate from above with opacity fade
- `exitStyle` - Animate upward when hiding
- `position="absolute"` - Overlay positioning below input

---

## Form Components

### Complete Signup Form Example

```typescript
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Info } from '@tamagui/lucide-icons'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { AnimatePresence, Button, H1, RadioGroup, Spinner, View } from 'tamagui'
import { z } from 'zod'
import { Input } from '../inputs/components/inputsParts'

const schema = z
  .object({
    firstName: z.string().min(1, { message: 'First name is required' }),
    lastName: z.string().min(1, { message: 'Last name is required' }),
    email: z.string().email({ message: 'Invalid email format' }),
    password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
    confirmedPassword: z.string().min(6, { message: 'Confirm password must be at least 6 characters' }),
    postalCode: z.string().min(4, { message: 'Invalid postal code format' }),
    accountType: z.string().min(1, { message: 'Account type is required' }),
  })
  .refine((data) => data.password === data.confirmedPassword, {
    message: 'Passwords do not match',
    path: ['confirmedPassword'],
  })

export function SignupValidatedHookForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmedPassword: '',
      postalCode: '',
      accountType: 'business',
    },
  })

  const onSubmit = (data: z.infer<typeof schema>) => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
    }, 2000)
  }

  return (
    <View gap="$5">
      <H1 self="center" size="$8">
        Create an account
      </H1>

      <View gap="$5">
        {/* First Name & Last Name */}
        <View
          flexDirection="row"
          justify="space-between"
          columnGap="$4"
          rowGap="$5"
        >
          <Controller
            control={control}
            name="firstName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                {...(errors.firstName && { theme: 'red' })}
                onBlur={onBlur}
                flex={1}
                size="$4"
              >
                <Input.Label>First Name</Input.Label>
                <Input.Box>
                  <Input.Area
                    placeholder="First name"
                    onChangeText={onChange}
                    value={value}
                  />
                </Input.Box>
                <AnimatePresence>
                  {errors.firstName && (
                    <View
                      b="$-5"
                      l={0}
                      position="absolute"
                      gap="$2"
                      flexDirection="row"
                      transition="bouncy"
                      enterStyle={{ opacity: 0, y: -10 }}
                      exitStyle={{ opacity: 0, y: -10 }}
                    >
                      <Input.Icon p={0}>
                        <Info />
                      </Input.Icon>
                      <Input.Info>{errors.firstName.message}</Input.Info>
                    </View>
                  )}
                </AnimatePresence>
              </Input>
            )}
          />
          
          <Controller
            control={control}
            name="lastName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                {...(errors.lastName && { theme: 'red' })}
                onBlur={onBlur}
                flex={1}
                size="$4"
              >
                <Input.Label>Last Name</Input.Label>
                <Input.Box>
                  <Input.Area
                    placeholder="Last name"
                    onChangeText={onChange}
                    value={value}
                  />
                </Input.Box>
                <AnimatePresence>
                  {errors.lastName && (
                    <View
                      b="$-5"
                      l={0}
                      position="absolute"
                      gap="$2"
                      flexDirection="row"
                      transition="bouncy"
                      enterStyle={{ opacity: 0, y: -10 }}
                      exitStyle={{ opacity: 0, y: -10 }}
                    >
                      <Input.Icon p={0}>
                        <Info />
                      </Input.Icon>
                      <Input.Info>{errors.lastName.message}</Input.Info>
                    </View>
                  )}
                </AnimatePresence>
              </Input>
            )}
          />
        </View>

        {/* Email */}
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              {...(errors.email && { theme: 'red' })}
              onBlur={onBlur}
              size="$4"
            >
              <Input.Label>Email</Input.Label>
              <Input.Box>
                <Input.Area
                  placeholder="email@example.com"
                  onChangeText={onChange}
                  value={value}
                />
              </Input.Box>
              <AnimatePresence>
                {errors.email && (
                  <View
                    b="$-5"
                    l={0}
                    position="absolute"
                    gap="$2"
                    flexDirection="row"
                    transition="bouncy"
                    enterStyle={{ opacity: 0, y: -10 }}
                    exitStyle={{ opacity: 0, y: -10 }}
                  >
                    <Input.Icon p={0}>
                      <Info />
                    </Input.Icon>
                    <Input.Info>{errors.email.message}</Input.Info>
                  </View>
                )}
              </AnimatePresence>
            </Input>
          )}
        />

        {/* Password with visibility toggle */}
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              {...(errors.password && { theme: 'red' })}
              onBlur={onBlur}
              size="$4"
            >
              <Input.Label htmlFor="password">Password</Input.Label>
              <Input.Box>
                <Input.Area
                  id="password"
                  secureTextEntry={!showPassword}
                  placeholder="Enter password"
                  onChangeText={onChange}
                  value={value}
                />
                <Input.Icon
                  cursor="pointer"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <Eye color="$color11" /> : <EyeOff color="$color11" />}
                </Input.Icon>
              </Input.Box>
              <AnimatePresence>
                {errors.password && (
                  <View
                    b="$-5"
                    l={0}
                    position="absolute"
                    gap="$2"
                    flexDirection="row"
                    transition="bouncy"
                    enterStyle={{ opacity: 0, y: -10 }}
                    exitStyle={{ opacity: 0, y: -10 }}
                  >
                    <Input.Icon p={0}>
                      <Info />
                    </Input.Icon>
                    <Input.Info>{errors.password.message}</Input.Info>
                  </View>
                )}
              </AnimatePresence>
            </Input>
          )}
        />

        {/* Account Type Radio */}
        <View flexDirection="column" gap="$1">
          <Input.Label htmlFor="account-type">Account type</Input.Label>
          <Controller
            control={control}
            name="accountType"
            render={({ field: { onChange, value } }) => (
              <RadioGroup
                gap="$8"
                flexDirection="row"
                value={value}
                onValueChange={onChange}
                id="account-type"
              >
                <View flexDirection="row" items="center" gap="$3">
                  <RadioGroup.Item id="personal" value="personal">
                    <RadioGroup.Indicator />
                  </RadioGroup.Item>
                  <Input.Label htmlFor="personal">Personal</Input.Label>
                </View>
                
                <View flexDirection="row" items="center" gap="$3">
                  <RadioGroup.Item id="business" value="business">
                    <RadioGroup.Indicator />
                  </RadioGroup.Item>
                  <Input.Label htmlFor="business">Business</Input.Label>
                </View>
              </RadioGroup>
            )}
          />
        </View>

        {/* Submit Button */}
        <Button
          theme="accent"
          disabled={loading}
          onPress={handleSubmit(onSubmit)}
          cursor={loading ? 'progress' : 'pointer'}
          width="100%"
          iconAfter={
            <AnimatePresence>
              {loading && (
                <Spinner
                  size="small"
                  color="$color"
                  key="loading-spinner"
                  position="absolute"
                  l={110}
                  transition="quick"
                  enterStyle={{ opacity: 0, scale: 0.5 }}
                  exitStyle={{ opacity: 0, scale: 0.5 }}
                />
              )}
            </AnimatePresence>
          }
        >
          Sign Up
        </Button>
      </View>
    </View>
  )
}
```

### FormCard Layout Component

```typescript
import { View, styled } from 'tamagui'

export const FormCard = styled(View, {
  render: 'form',
  flexDirection: 'row',
  maxW: '100%',
  rounded: 30,
  $gtSm: {
    p: '$6',
    shadowColor: '$shadowColor',
    shadowOffset: {
      width: 0,
      height: 9,
    },
    shadowOpacity: 0.5,
    shadowRadius: 12.35,
  },
  $xs: {
    borderWidth: 0,
    rounded: 0,
    px: '$1',
  },
})

// Usage:
<FormCard
  flexDirection="column"
  gap="$5"
  render="form"
  $group-window-sm={{
    px: '$4',
    py: '$6',
  }}
>
  {/* Form content */}
</FormCard>
```

---

## Advanced Patterns

### Password Visibility Toggle

```typescript
const [showPassword, setShowPassword] = useState(false)

<Controller
  control={control}
  name="password"
  render={({ field: { onChange, onBlur, value } }) => (
    <Input size="$4">
      <Input.Label htmlFor="password">Password</Input.Label>
      <Input.Box>
        <Input.Area
          id="password"
          secureTextEntry={!showPassword}
          placeholder="Enter password"
          onChangeText={onChange}
          value={value}
        />
        <Input.Icon
          cursor="pointer"
          onPress={() => setShowPassword(!showPassword)}
        >
          {showPassword ? <Eye color="$color11" /> : <EyeOff color="$color11" />}
        </Input.Icon>
      </Input.Box>
    </Input>
  )}
/>
```

### Phone Number Input with Region Selector

```typescript
import { Globe2, Search, X } from '@tamagui/lucide-icons'
import { Adapt, Popover, ScrollView, Sheet, View } from 'tamagui'

function PhoneInputExample() {
  const [regionCode, setRegionCode] = useState('US')
  const [phoneNumber, setPhoneNumber] = useState('+1 ')
  const [containerWidth, setContainerWidth] = useState<number>()

  useEffect(() => {
    if (regionCode) {
      setPhoneNumber('+' + DIAL_CODES[regionCode] + ' ')
    }
  }, [regionCode])

  return (
    <Input size="$4">
      <Input.Box
        onLayout={(e) => {
          setContainerWidth(e.nativeEvent.layout.width)
        }}
      >
        <Input.Section>
          <RegionSelectBox
            containerWidth={containerWidth}
            regionCode={regionCode}
            setRegionCode={setRegionCode}
          />
        </Input.Section>
        <Input.Section>
          <Input.Area
            keyboardType="numeric"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Phone number"
          />
        </Input.Section>
      </Input.Box>
    </Input>
  )
}
```

**Phone number validation** (recommended):
```typescript
import { isValidPhoneNumber } from 'libphonenumber-js'

const phoneNumberSchema = z.string().refine(
  isValidPhoneNumber,
  (val) => ({ message: `${val} is not a valid phone number` })
)

const schema = z.object({
  phone_number: phoneNumberSchema
})
```

### One-Time Code (OTP) Input

Full implementation in Bento using React Hook Form:

```typescript
import { Controller, useForm } from 'react-hook-form'

interface FormFields {
  [key: string]: string  // code0, code1, code2, code3
}

function CodeConfirmation({ codeSize = 4, onEnter }: CodeConfirmationProps) {
  const defaultValues = Array.from({ length: codeSize }, (_, i) => `code${i}`).reduce(
    (acc, key) => ({ ...acc, [key]: '' }),
    {}
  )

  const { control, setFocus, register, handleSubmit, setValue } = useForm<FormFields>({
    defaultValues: defaultValues,
  })

  const switchInputPlace = (currentInput: number, value: string) => {
    if (value === '') {
      setFocus(`code${currentInput - 1}`)
    } else {
      setFocus(`code${currentInput + 1}`)
    }
  }

  const onSubmit = handleSubmit((data) => {
    const code = Number(Object.values(data).join(''))
    onEnter(code)
  })

  return (
    <Form onSubmit={onSubmit}>
      {Array(codeSize).fill(null).map((_, id) => (
        <Controller
          key={`code${id}`}
          name={`code${id}`}
          control={control}
          rules={{ required: true, pattern: /^[0-9]*$/ }}
          render={({ field: { value, onChange } }) => (
            <Input
              {...register(`code${id}`)}
              value={value}
              maxLength={1}
              onChange={(e: any) => {
                const code = e.target?.value ?? e.nativeEvent?.text ?? ''
                onChange(code.split('')[0])
                switchInputPlace(id, code)
              }}
              onKeyDown={(e: any) => {
                if (e.key === 'Backspace') {
                  e.preventDefault()
                  if (value !== '') {
                    onChange('')
                  } else {
                    switchInputPlace(id, value)
                  }
                }
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              textAlign="center"
            />
          )}
        />
      ))}
    </Form>
  )
}
```

**Features:**
- Auto-focus next input on entry
- Backspace navigation
- Paste support for full code
- Numeric keyboard on mobile
- Auto-complete="one-time-code" for SMS autofill

### Custom Input Components

Create reusable input wrappers for consistent styling:

```typescript
type TextInputProps = {
  label: string
  labelId: string
  placeholder?: string
  value: string
  onChange: (text: string) => void
  onBlur: () => void
  error?: string
}

const TextInput = (props: TextInputProps) => {
  const { label, labelId, placeholder, value, onChange, onBlur, error } = props
  const { size } = InputContext.useStyledContext()
  
  return (
    <Input
      {...(error && { theme: 'red' })}
      onBlur={onBlur}
      size={size}
    >
      <Input.Label htmlFor={labelId}>{label}</Input.Label>
      <Input.Box>
        <Input.Area
          id={labelId}
          placeholder={placeholder}
          onChangeText={onChange}
          value={value}
        />
      </Input.Box>
      <AnimatePresence>
        {error && (
          <View
            b="$-5"
            l={0}
            position="absolute"
            gap="$2"
            flexDirection="row"
            transition="bouncy"
            enterStyle={{ opacity: 0, y: -10 }}
            exitStyle={{ opacity: 0, y: -10 }}
          >
            <Input.Icon p={0}>
              <Info />
            </Input.Icon>
            <Input.Info>{error}</Input.Info>
          </View>
        )}
      </AnimatePresence>
    </Input>
  )
}

// Usage with Controller:
<Controller
  control={control}
  name="email"
  render={({ field, fieldState }) => (
    <TextInput
      label="Email"
      labelId="email"
      placeholder="Email"
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
    />
  )}
/>
```

### Nested Schema Validation

Handle complex nested form structures:

```typescript
const twoInputSchema = z.object({
  firstInput: z.string().min(1, { message: 'This field is required' }),
  secondInput: z.string().min(1, { message: 'This field is required' }),
})

const schema = z.object({
  fullName: twoInputSchema,
  email: z.string().email(),
})

type FormValues = z.infer<typeof schema>

// Controller handles nested values:
<Controller
  control={control}
  name="fullName"
  render={({ field, fieldState }) => (
    <TwoInput
      values={{
        firstInput: { label: 'First Name', labelId: 'firstName', placeholder: 'First name' },
        secondInput: { label: 'Last Name', labelId: 'lastName', placeholder: 'Last name' },
      }}
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      error={fieldState.error as any}
    />
  )}
/>
```

---

## Accessibility

### Label Associations

Always use `htmlFor` to associate labels with inputs:

```typescript
<Input.Label htmlFor="email">Email</Input.Label>
<Input.Box>
  <Input.Area id="email" placeholder="email@example.com" />
</Input.Box>
```

**Benefits:**
- Screen readers announce label when input is focused
- Clicking label focuses input
- Improves keyboard navigation

### Error Announcements

Use ARIA live regions for error announcements:

```typescript
<AnimatePresence>
  {errors.email && (
    <View
      position="absolute"
      role="alert"
      aria-live="polite"
    >
      <Input.Info>{errors.email.message}</Input.Info>
    </View>
  )}
</AnimatePresence>
```

### Keyboard Navigation

Input.Area automatically handles:
- **Tab navigation** - `tabIndex={0}` on web, `focusable={true}` on native
- **Enter key** - Set `enterKeyHint` for mobile keyboards
- **Focus styles** - Automatically applied via `focusStyle`

### Form Submission

Use proper form semantics:

```typescript
<FormCard render="form">  {/* Renders as <form> element */}
  {/* inputs */}
  <Button 
    onPress={handleSubmit(onSubmit)}
    type="submit"  // Native form submission
  >
    Submit
  </Button>
</FormCard>
```

---

## Quick Reference

### Input Component Anatomy

```typescript
<Input size="$4" gapScale={0.5}>
  <Input.Label htmlFor="id">Label</Input.Label>
  <Input.Box>
    <Input.Section>
      <Input.Icon><User /></Input.Icon>
    </Input.Section>
    <Input.Section>
      <Input.Area id="id" placeholder="Placeholder" />
    </Input.Section>
    <Input.Section>
      <Input.Button><Eye /></Input.Button>
    </Input.Section>
  </Input.Box>
  <Input.Info>Helper text</Input.Info>
</Input>
```

### Common Size Tokens

```typescript
size="$2"  // Extra small
size="$3"  // Small
size="$4"  // Medium (default)
size="$5"  // Large
size="$6"  // Extra large
```

### Theme Variants

```typescript
theme="red"     // Error state
theme="green"   // Success state
theme="blue"    // Info state
theme="accent"  // Accent color
```

### Input.Area Props

```typescript
<Input.Area
  id="unique-id"
  placeholder="Placeholder text"
  value={value}
  onChangeText={(text) => {}}  // Normalized for web/native
  onBlur={() => {}}
  secureTextEntry={true}       // Password input
  keyboardType="numeric"       // Mobile keyboard type
  textContentType="emailAddress"  // Autofill hints
  inputMode="email"            // Web input mode
  autoComplete="email"         // Autocomplete
  autoFocus={true}             // Focus on mount
/>
```

### Controller Pattern

```typescript
<Controller
  control={control}
  name="fieldName"
  render={({ field, fieldState }) => (
    <Input {...(fieldState.error && { theme: 'red' })}>
      <Input.Area
        value={field.value}
        onChangeText={field.onChange}
        onBlur={field.onBlur}
      />
      {fieldState.error && (
        <Input.Info>{fieldState.error.message}</Input.Info>
      )}
    </Input>
  )}
/>
```

### Form Setup Checklist

1. **Install dependencies:**
   ```bash
   npm install react-hook-form @hookform/resolvers zod
   ```

2. **Define schema:**
   ```typescript
   const schema = z.object({ /* fields */ })
   ```

3. **Initialize form:**
   ```typescript
   const { control, handleSubmit, formState: { errors } } = useForm({
     resolver: zodResolver(schema),
     defaultValues: { /* defaults */ }
   })
   ```

4. **Wrap inputs with Controller:**
   ```typescript
   <Controller control={control} name="field" render={...} />
   ```

5. **Handle submission:**
   ```typescript
   <Button onPress={handleSubmit(onSubmit)}>Submit</Button>
   ```

---

## Best Practices

### Error Handling

- ✅ Use `theme="red"` on Input for error state
- ✅ Use `AnimatePresence` for smooth error transitions
- ✅ Position errors absolutely to prevent layout shifts
- ✅ Include error icons for visual clarity
- ❌ Don't show errors before user interaction (use `onBlur`)

### Performance

- ✅ Use `Controller` instead of `register` for Tamagui components
- ✅ Memoize complex validation with `useMemo`
- ✅ Set `defaultValues` to prevent uncontrolled inputs
- ❌ Don't validate on every keystroke (use `mode: 'onBlur'`)

### Type Safety

- ✅ Use `z.infer<typeof schema>` for form types
- ✅ Type Controller render props: `({ field, fieldState })`
- ✅ Define custom input prop types for reusable components
- ❌ Don't use `any` for field errors

### Styling

- ✅ Use consistent size tokens across form
- ✅ Leverage InputContext for shared size/color
- ✅ Use theme variants for semantic states
- ❌ Don't override focus styles without accessibility testing

---

**Documentation Version:** 1.0.0  
**Last Updated:** 2024-01-24  
**Source:** @tamagui/bento forms components  
**Dependencies:** react-hook-form ^7.x, @hookform/resolvers ^3.x, zod ^3.x, tamagui ^1.144.0+
