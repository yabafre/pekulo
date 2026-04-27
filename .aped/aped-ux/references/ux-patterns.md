# UX Design Rules — Priority-Ranked

Rules ranked by impact. Apply in order — never skip a higher-priority rule for a lower one.

---

## P1: Accessibility (CRITICAL)

- Contrast ≥ 4.5:1 normal text, ≥ 3:1 large text (WCAG AA)
- Visible focus rings (2-4px) on ALL interactive elements
- Alt text on meaningful images; decorative images use alt=""
- aria-label on icon-only buttons
- Tab order matches visual order; full keyboard support
- Form inputs have visible labels (not placeholder-only)
- Skip-to-main-content link for keyboard users
- Heading hierarchy: sequential h1→h6, no level skipping
- Information never relies on color alone (add icon/text)
- Support dynamic text scaling (no truncation on resize)
- Respect prefers-reduced-motion — disable animations when set
- Screen reader: meaningful labels, logical reading order
- Escape routes: cancel/back in modals and multi-step flows
- Preserve system keyboard shortcuts

## P2: Touch & Interaction (CRITICAL)

- Touch targets ≥ 44x44pt (iOS) / 48x48dp (Android)
- Minimum 8px gap between touch targets
- Primary interactions via tap, never hover-only
- Loading buttons: disable during async + show spinner
- Error feedback: clear message near the problem field
- cursor:pointer on clickable web elements
- No horizontal swipe conflicts on main content
- touch-action:manipulation to kill 300ms tap delay
- Use platform-standard gestures consistently
- Don't block system gestures (back swipe, control center)
- Visual press feedback (ripple/opacity) within 80-150ms
- Haptic feedback for confirmations only — no overuse
- Always provide visible controls alongside gestures
- Keep targets away from notch, Dynamic Island, edges
- No precision-required taps on tiny icons

## P3: Performance (HIGH)

- Images: WebP/AVIF, responsive srcset, lazy load below fold
- Declare width/height or aspect-ratio to prevent CLS
- font-display:swap, preload only critical fonts
- Critical CSS above the fold; lazy load the rest
- Code split by route/feature
- Third-party scripts: async/defer, audit necessity
- Batch DOM reads then writes to reduce reflows
- Reserve space for async content (no content jumping)
- Virtualize lists with 50+ items
- Keep per-frame work under 16ms for 60fps
- Skeleton/shimmer for operations >300ms
- Input latency under 100ms for taps/scrolls
- Debounce/throttle high-frequency events (scroll, resize, input)
- Provide offline state messaging
- Degraded mode for slow networks

## P4: Style & Consistency (HIGH)

- Match visual style to product type and audience
- Same style across all screens — no mixed aesthetics
- SVG icons only (Lucide, Heroicons) — never emoji as structural icons
- Color palette derived from product domain/industry
- Effects (shadows, blur, radius) aligned with chosen style
- Respect platform idioms (iOS HIG vs Material Design)
- Hover/pressed/disabled states visually distinct
- Consistent elevation/shadow scale across components
- Design light and dark variants together from day 1
- One icon set, one visual language throughout
- Prefer native controls over custom when possible
- One primary CTA per screen — secondary actions subordinate

## P5: Layout & Responsive (HIGH)

- viewport meta: width=device-width, initial-scale=1
- Mobile-first: design small, scale up
- Systematic breakpoints: 375 / 768 / 1024 / 1440
- Minimum 16px body text on mobile
- Line length: 35-60 chars mobile, 60-75 chars desktop
- No horizontal scroll on any breakpoint
- 4pt/8dp spacing scale consistently applied
- Consistent max-width container on desktop (1200-1440px)
- Layered z-index scale (avoid arbitrary values)
- Safe padding for fixed/sticky elements
- Avoid nested scroll regions
- Prefer min-h-dvh over 100vh (mobile address bar)
- Content priority: core content first on mobile
- Visual hierarchy via size, spacing, and contrast

## P6: Typography & Color (MEDIUM)

- Body line-height: 1.5-1.75
- Font pairing: match heading/body personalities
- Consistent type scale: 12/14/16/18/24/32
- Weight hierarchy: bold headings (600-700), regular body (400)
- Semantic color tokens: primary, secondary, error, warning, success, surface
- Dark mode: desaturated/lighter variants, NOT inverted colors
- Foreground/background pairs meet 4.5:1 (AA) or 7:1 (AAA)
- Prefer text wrapping over truncation; ellipsis only with tooltip
- Tabular figures for data columns, prices, timers
- Intentional whitespace to group and separate

## P7: Animation (MEDIUM)

- Duration: 150-300ms micro-interactions, ≤400ms complex, never >500ms
- Animate transform and opacity ONLY (GPU composited)
- ease-out entering, ease-in exiting
- Every animation must express cause-effect (meaningful motion)
- Max 1-2 animated elements per view transition
- Exit animations ~60-70% of enter duration
- Stagger list items by 30-50ms
- Animations must be interruptible by user
- Never block user input during animation
- Subtle scale feedback on press (0.95-1.05)
- Real-time response to drag/swipe/pinch gestures
- Animations must not cause CLS (no layout shift)
- Modal: animate from trigger source
- Navigation: forward = left/up, backward = right/down

## P8: Forms & Feedback (MEDIUM)

- Visible label per input — never placeholder-only
- Error shown below the field, near the problem
- Submit: show loading → then success/error state
- Mark required fields (asterisk + sr-only text)
- Empty states: helpful message + CTA action
- Toast: auto-dismiss 3-5s, use aria-live="polite"
- Confirm before destructive actions
- Persistent helper text below complex inputs
- Disabled: opacity 0.38-0.5 + cursor change + no tap
- Progressive disclosure: reveal options step by step
- Validate on blur, show error after user finishes typing
- Semantic input types (email, tel, number, url)
- Password show/hide toggle
- Support autocomplete/textContentType for autofill
- Allow undo for destructive actions
- Auto-focus first invalid field after submit
- Error summary at top with anchor links for long forms
- Mobile input height ≥ 44px
- Unsaved changes: confirm before dismissing

## P9: Navigation (HIGH)

- Bottom nav ≤ 5 items, each with icon + label
- Drawer for secondary nav only, not primary
- Predictable back behavior; preserve scroll/state
- All key screens reachable via deep link/URL
- Current location visually highlighted (active state)
- Primary vs secondary navigation clearly separated
- Modal: clear close affordance, swipe-down on mobile
- Search: accessible from top bar or dedicated tab
- Breadcrumb for 3+ level deep hierarchies
- Restore scroll, filters, input on back navigation
- Adaptive: sidebar ≥1024px, bottom/top nav for small screens
- Never silently reset navigation stack
- Same navigation placement across all pages
- Don't mix Tab + Sidebar + Bottom Nav simultaneously
- Focus moves to main content on route change

## P10: Charts & Data (LOW)

- Match chart type to data: trend→line, comparison→bar, proportion→pie
- Accessible color palettes — supplement with patterns/textures
- Always show legend near chart
- Tooltip on hover (web) or tap (mobile)
- Label axes with units; never truncate/rotate axis labels
- Responsive: reflow charts on small screens
- Empty data: show "No data yet" with action
- Skeleton placeholder while loading
- Respect prefers-reduced-motion for chart animations
- Virtualize/aggregate datasets >1000 points
- Interactive elements ≥ 44pt tap area
- No pie chart for >5 categories
- Direct-label values for small datasets
- Offer CSV/image export for data tables
- Screen reader: aria-label describing key insight

---

## Screen Types

### Form Screens
- **Login/Register**: email + password, social auth buttons, forgot link
- **Settings**: grouped sections, save/cancel, inline validation
- **Wizard/Multi-step**: progress indicator, back/next, step validation
- **Search + Filters**: search bar, filter sidebar/chips, results list

### List Screens
- **Data Table**: sortable headers, row actions, pagination, bulk select
- **Card Grid**: image + title + meta, responsive columns, load more
- **Feed/Timeline**: chronological, infinite scroll, activity items

### Detail Screens
- **Profile/Entity**: header (avatar, name, stats), tabbed content, actions
- **Article/Content**: title, meta, body, sidebar, related items

### Dashboard Screens
- **Analytics**: stat cards, charts, date range picker, export
- **Admin**: sidebar nav, content area, notification badge

### Utility Screens
- **Empty State**: illustration, message, CTA button
- **Error Page**: error code, message, back/home links
- **Loading**: skeleton screens, progress bar, spinner

---

## Pre-Delivery Checklist

### Visual Quality
- [ ] SVG icons only — no emoji as structural elements
- [ ] Consistent icon family and stroke width
- [ ] Press states don't shift layout or cause jitter
- [ ] Semantic theme tokens used consistently
- [ ] Official brand assets with correct proportions

### Interaction
- [ ] All tappable elements provide press feedback
- [ ] Touch targets ≥ 44x44pt / 48x48dp
- [ ] Micro-interactions 150-300ms with native easing
- [ ] Disabled states visually clear and non-interactive
- [ ] Screen reader focus order matches visual layout
- [ ] No gesture conflicts between app and system

### Light/Dark Mode
- [ ] Primary text ≥ 4.5:1 contrast in both modes
- [ ] Secondary text ≥ 3:1 contrast in both modes
- [ ] Borders/dividers distinguishable in both modes
- [ ] Modal scrim preserves foreground legibility
- [ ] Both themes tested independently

### Layout
- [ ] Safe areas respected for fixed elements
- [ ] Scroll content not hidden behind fixed bars
- [ ] Tested: small phone, large phone, tablet (portrait + landscape)
- [ ] 4/8dp spacing maintained throughout
- [ ] Long-form text readable on larger screens

### Accessibility
- [ ] Meaningful images/icons have labels
- [ ] Form fields have labels, hints, clear errors
- [ ] Color not sole indicator of state
- [ ] Reduced motion and dynamic text size supported
- [ ] ARIA roles/states announced correctly
