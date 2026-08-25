import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloCalendar } from "./PekuloCalendar";

// AC-4: the rendered month comes from an explicit prop, never the system
// clock. react-day-picker defaults to the current month — a snapshot taken
// without `month` encodes whatever month it was written in and turns red on
// the 1st of the next one.
const JANUARY_2026 = new Date(2026, 0, 1);
const JANUARY_15_2026 = new Date(2026, 0, 15);

describe("PekuloCalendar snapshot", () => {
  it("renders a fixed month with no selection", () => {
    const { container } = renderWithTamagui(<PekuloCalendar mode="single" month={JANUARY_2026} />);
    expect(container.innerHTML).toMatchInlineSnapshot(`
      "<span class="_dsp_contents  font_body"><style>
      .pekulo-calendar {
        --rdp-accent-color: var(--color);
        --rdp-accent-background-color: var(--backgroundMuted);
        --rdp-background-color: var(--background);
        --rdp-cell-size: 36px;
        --rdp-day_button-border-radius: 8px;
        --rdp-day_button-width: 36px;
        --rdp-day_button-height: 36px;
        font-family: inherit;
        color: var(--color);
      }
      /* Layout — we don't import react-day-picker's base CSS, so we provide
       * the structural rules ourselves (months row, weekday grid, table
       * collapse). Without these the months render as block-level stacked
       * vertically — broken for range mode with 2 months side-by-side. */
      /* .rdp-nav is a sibling of all months at the .rdp-months level (NOT
       * inside each month). Make .rdp-months the positioned ancestor so the
       * nav can be absolutely positioned across the whole months container --
       * prev on far-left, next on far-right, single shared set of chevrons
       * for both months in range mode. */
      .pekulo-calendar .rdp-months {
        display: flex;
        flex-direction: row;
        gap: 16px;
        flex-wrap: wrap;
        position: relative;
        padding-top: 32px;
      }
      .pekulo-calendar .rdp-month {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .pekulo-calendar .rdp-month_caption {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 32px;
      }
      .pekulo-calendar .rdp-nav {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 28px;
        pointer-events: none;
        z-index: 1;
      }
      .pekulo-calendar .rdp-button_previous,
      .pekulo-calendar .rdp-button_next {
        pointer-events: auto;
        width: 28px;
        height: 28px;
        border-radius: 9999px;
        background: transparent;
        border: 0;
        color: var(--colorTertiary);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background-color 150ms, color 150ms;
      }
      .pekulo-calendar .rdp-button_previous:hover:not([disabled]),
      .pekulo-calendar .rdp-button_next:hover:not([disabled]) {
        background: var(--backgroundMuted);
        color: var(--color);
      }
      .pekulo-calendar .rdp-button_previous:focus-visible,
      .pekulo-calendar .rdp-button_next:focus-visible {
        outline: 2px solid var(--color);
        outline-offset: 2px;
      }
      .pekulo-calendar .rdp-button_previous[disabled],
      .pekulo-calendar .rdp-button_next[disabled] {
        opacity: 0.3;
        cursor: not-allowed;
      }
      .pekulo-calendar .rdp-chevron {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
      .pekulo-calendar .rdp-month_grid,
      .pekulo-calendar .rdp-table {
        border-collapse: collapse;
        width: 100%;
      }
      .pekulo-calendar .rdp-weekdays {
        display: table-row;
      }
      .pekulo-calendar .rdp-weekday {
        display: table-cell;
        text-align: center;
        padding: 4px 0;
      }
      .pekulo-calendar .rdp-weeks {
        display: table-row-group;
      }
      .pekulo-calendar .rdp-week {
        display: table-row;
      }
      .pekulo-calendar .rdp-day {
        display: table-cell;
        text-align: center;
        padding: 2px 0;
      }
      .pekulo-calendar .rdp-day_button {
        color: var(--color);
        background: transparent;
        border: 0;
        cursor: pointer;
        border-radius: 8px;
        width: 36px;
        height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .pekulo-calendar .rdp-day_button:hover:not([disabled]) {
        background: var(--backgroundMuted);
      }
      .pekulo-calendar .rdp-day_button:focus-visible {
        outline: 2px solid var(--color);
        outline-offset: 2px;
      }
      .pekulo-calendar .rdp-day.rdp-selected .rdp-day_button {
        background: var(--color);
        color: var(--colorOnAccent);
      }
      .pekulo-calendar .rdp-day.rdp-today .rdp-day_button {
        font-weight: 600;
      }
      .pekulo-calendar .rdp-day.rdp-outside .rdp-day_button {
        color: var(--colorTertiary);
        opacity: 0.5;
      }
      .pekulo-calendar .rdp-day.rdp-disabled .rdp-day_button {
        cursor: not-allowed;
        opacity: 0.4;
      }
      .pekulo-calendar .rdp-weekday {
        color: var(--colorTertiary);
        font-size: 12px;
        font-weight: 400;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .pekulo-calendar .rdp-month_caption {
        font-size: 14px;
        font-weight: 500;
        color: var(--color);
        padding: 4px 0;
      }
      .pekulo-calendar .rdp-nav button {
        background: transparent;
        border: 0;
        color: var(--colorTertiary);
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 9999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .pekulo-calendar .rdp-nav button:hover {
        background: var(--backgroundMuted);
        color: var(--color);
      }
      </style><div data-slot="calendar" class="pekulo-calendar" style="background-color: var(--backgroundCard); border-radius: 12px; padding: 12px;"><div class="rdp-root" lang="fr" data-mode="single"><div class="rdp-months"><nav class="rdp-nav" aria-label="Barre de navigation"><button type="button" class="rdp-button_previous" aria-label="Aller au mois précédent"><svg class="rdp-chevron" width="24" height="24" viewBox="0 0 24 24"><polygon points="16 18.112 9.81111111 12 16 5.87733333 14.0888889 4 6 12 14.0888889 20"></polygon></svg></button><button type="button" class="rdp-button_next" aria-label="Aller au mois suivant"><svg class="rdp-chevron" width="24" height="24" viewBox="0 0 24 24"><polygon points="8 18.112 14.18888889 12 8 5.87733333 9.91111111 4 18 12 9.91111111 20"></polygon></svg></button></nav><div class="rdp-month"><div class="rdp-month_caption"><span class="rdp-caption_label" role="status" aria-live="polite">janvier 2026</span></div><table role="grid" aria-multiselectable="false" aria-label="janvier 2026" class="rdp-month_grid"><thead aria-hidden="true"><tr class="rdp-weekdays"><th aria-label="lundi" class="rdp-weekday" scope="col">lu</th><th aria-label="mardi" class="rdp-weekday" scope="col">ma</th><th aria-label="mercredi" class="rdp-weekday" scope="col">me</th><th aria-label="jeudi" class="rdp-weekday" scope="col">je</th><th aria-label="vendredi" class="rdp-weekday" scope="col">ve</th><th aria-label="samedi" class="rdp-weekday" scope="col">sa</th><th aria-label="dimanche" class="rdp-weekday" scope="col">di</th></tr></thead><tbody class="rdp-weeks"><tr class="rdp-week"><td class="rdp-day rdp-outside" role="gridcell" data-day="2025-12-29" data-month="2025-12" data-outside="true"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="lundi 29 décembre 2025">29</button></td><td class="rdp-day rdp-outside" role="gridcell" data-day="2025-12-30" data-month="2025-12" data-outside="true"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mardi 30 décembre 2025">30</button></td><td class="rdp-day rdp-outside" role="gridcell" data-day="2025-12-31" data-month="2025-12" data-outside="true"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mercredi 31 décembre 2025">31</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-01"><button class="rdp-day_button" type="button" tabindex="0" aria-label="jeudi 1 janvier 2026">1</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-02"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="vendredi 2 janvier 2026">2</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-03"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="samedi 3 janvier 2026">3</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-04"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="dimanche 4 janvier 2026">4</button></td></tr><tr class="rdp-week"><td class="rdp-day" role="gridcell" data-day="2026-01-05"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="lundi 5 janvier 2026">5</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-06"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mardi 6 janvier 2026">6</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-07"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mercredi 7 janvier 2026">7</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-08"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="jeudi 8 janvier 2026">8</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-09"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="vendredi 9 janvier 2026">9</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-10"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="samedi 10 janvier 2026">10</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-11"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="dimanche 11 janvier 2026">11</button></td></tr><tr class="rdp-week"><td class="rdp-day" role="gridcell" data-day="2026-01-12"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="lundi 12 janvier 2026">12</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-13"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mardi 13 janvier 2026">13</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-14"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mercredi 14 janvier 2026">14</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-15"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="jeudi 15 janvier 2026">15</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-16"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="vendredi 16 janvier 2026">16</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-17"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="samedi 17 janvier 2026">17</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-18"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="dimanche 18 janvier 2026">18</button></td></tr><tr class="rdp-week"><td class="rdp-day" role="gridcell" data-day="2026-01-19"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="lundi 19 janvier 2026">19</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-20"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mardi 20 janvier 2026">20</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-21"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mercredi 21 janvier 2026">21</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-22"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="jeudi 22 janvier 2026">22</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-23"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="vendredi 23 janvier 2026">23</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-24"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="samedi 24 janvier 2026">24</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-25"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="dimanche 25 janvier 2026">25</button></td></tr><tr class="rdp-week"><td class="rdp-day" role="gridcell" data-day="2026-01-26"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="lundi 26 janvier 2026">26</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-27"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mardi 27 janvier 2026">27</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-28"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mercredi 28 janvier 2026">28</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-29"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="jeudi 29 janvier 2026">29</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-30"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="vendredi 30 janvier 2026">30</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-31"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="samedi 31 janvier 2026">31</button></td><td class="rdp-day rdp-outside" role="gridcell" data-day="2026-02-01" data-month="2026-02" data-outside="true"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="dimanche 1 février 2026">1</button></td></tr></tbody></table></div></div></div></div><div style="display: contents;"></div></span>"
    `);
  });

  it("renders a fixed month with a selected day", () => {
    const { container } = renderWithTamagui(
      <PekuloCalendar mode="single" month={JANUARY_2026} selected={JANUARY_15_2026} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`
      "<span class="_dsp_contents  font_body"><style>
      .pekulo-calendar {
        --rdp-accent-color: var(--color);
        --rdp-accent-background-color: var(--backgroundMuted);
        --rdp-background-color: var(--background);
        --rdp-cell-size: 36px;
        --rdp-day_button-border-radius: 8px;
        --rdp-day_button-width: 36px;
        --rdp-day_button-height: 36px;
        font-family: inherit;
        color: var(--color);
      }
      /* Layout — we don't import react-day-picker's base CSS, so we provide
       * the structural rules ourselves (months row, weekday grid, table
       * collapse). Without these the months render as block-level stacked
       * vertically — broken for range mode with 2 months side-by-side. */
      /* .rdp-nav is a sibling of all months at the .rdp-months level (NOT
       * inside each month). Make .rdp-months the positioned ancestor so the
       * nav can be absolutely positioned across the whole months container --
       * prev on far-left, next on far-right, single shared set of chevrons
       * for both months in range mode. */
      .pekulo-calendar .rdp-months {
        display: flex;
        flex-direction: row;
        gap: 16px;
        flex-wrap: wrap;
        position: relative;
        padding-top: 32px;
      }
      .pekulo-calendar .rdp-month {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .pekulo-calendar .rdp-month_caption {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 32px;
      }
      .pekulo-calendar .rdp-nav {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 28px;
        pointer-events: none;
        z-index: 1;
      }
      .pekulo-calendar .rdp-button_previous,
      .pekulo-calendar .rdp-button_next {
        pointer-events: auto;
        width: 28px;
        height: 28px;
        border-radius: 9999px;
        background: transparent;
        border: 0;
        color: var(--colorTertiary);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background-color 150ms, color 150ms;
      }
      .pekulo-calendar .rdp-button_previous:hover:not([disabled]),
      .pekulo-calendar .rdp-button_next:hover:not([disabled]) {
        background: var(--backgroundMuted);
        color: var(--color);
      }
      .pekulo-calendar .rdp-button_previous:focus-visible,
      .pekulo-calendar .rdp-button_next:focus-visible {
        outline: 2px solid var(--color);
        outline-offset: 2px;
      }
      .pekulo-calendar .rdp-button_previous[disabled],
      .pekulo-calendar .rdp-button_next[disabled] {
        opacity: 0.3;
        cursor: not-allowed;
      }
      .pekulo-calendar .rdp-chevron {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
      .pekulo-calendar .rdp-month_grid,
      .pekulo-calendar .rdp-table {
        border-collapse: collapse;
        width: 100%;
      }
      .pekulo-calendar .rdp-weekdays {
        display: table-row;
      }
      .pekulo-calendar .rdp-weekday {
        display: table-cell;
        text-align: center;
        padding: 4px 0;
      }
      .pekulo-calendar .rdp-weeks {
        display: table-row-group;
      }
      .pekulo-calendar .rdp-week {
        display: table-row;
      }
      .pekulo-calendar .rdp-day {
        display: table-cell;
        text-align: center;
        padding: 2px 0;
      }
      .pekulo-calendar .rdp-day_button {
        color: var(--color);
        background: transparent;
        border: 0;
        cursor: pointer;
        border-radius: 8px;
        width: 36px;
        height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .pekulo-calendar .rdp-day_button:hover:not([disabled]) {
        background: var(--backgroundMuted);
      }
      .pekulo-calendar .rdp-day_button:focus-visible {
        outline: 2px solid var(--color);
        outline-offset: 2px;
      }
      .pekulo-calendar .rdp-day.rdp-selected .rdp-day_button {
        background: var(--color);
        color: var(--colorOnAccent);
      }
      .pekulo-calendar .rdp-day.rdp-today .rdp-day_button {
        font-weight: 600;
      }
      .pekulo-calendar .rdp-day.rdp-outside .rdp-day_button {
        color: var(--colorTertiary);
        opacity: 0.5;
      }
      .pekulo-calendar .rdp-day.rdp-disabled .rdp-day_button {
        cursor: not-allowed;
        opacity: 0.4;
      }
      .pekulo-calendar .rdp-weekday {
        color: var(--colorTertiary);
        font-size: 12px;
        font-weight: 400;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .pekulo-calendar .rdp-month_caption {
        font-size: 14px;
        font-weight: 500;
        color: var(--color);
        padding: 4px 0;
      }
      .pekulo-calendar .rdp-nav button {
        background: transparent;
        border: 0;
        color: var(--colorTertiary);
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 9999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .pekulo-calendar .rdp-nav button:hover {
        background: var(--backgroundMuted);
        color: var(--color);
      }
      </style><div data-slot="calendar" class="pekulo-calendar" style="background-color: var(--backgroundCard); border-radius: 12px; padding: 12px;"><div class="rdp-root" lang="fr" data-mode="single"><div class="rdp-months"><nav class="rdp-nav" aria-label="Barre de navigation"><button type="button" class="rdp-button_previous" aria-label="Aller au mois précédent"><svg class="rdp-chevron" width="24" height="24" viewBox="0 0 24 24"><polygon points="16 18.112 9.81111111 12 16 5.87733333 14.0888889 4 6 12 14.0888889 20"></polygon></svg></button><button type="button" class="rdp-button_next" aria-label="Aller au mois suivant"><svg class="rdp-chevron" width="24" height="24" viewBox="0 0 24 24"><polygon points="8 18.112 14.18888889 12 8 5.87733333 9.91111111 4 18 12 9.91111111 20"></polygon></svg></button></nav><div class="rdp-month"><div class="rdp-month_caption"><span class="rdp-caption_label" role="status" aria-live="polite">janvier 2026</span></div><table role="grid" aria-multiselectable="false" aria-label="janvier 2026" class="rdp-month_grid"><thead aria-hidden="true"><tr class="rdp-weekdays"><th aria-label="lundi" class="rdp-weekday" scope="col">lu</th><th aria-label="mardi" class="rdp-weekday" scope="col">ma</th><th aria-label="mercredi" class="rdp-weekday" scope="col">me</th><th aria-label="jeudi" class="rdp-weekday" scope="col">je</th><th aria-label="vendredi" class="rdp-weekday" scope="col">ve</th><th aria-label="samedi" class="rdp-weekday" scope="col">sa</th><th aria-label="dimanche" class="rdp-weekday" scope="col">di</th></tr></thead><tbody class="rdp-weeks"><tr class="rdp-week"><td class="rdp-day rdp-outside" role="gridcell" data-day="2025-12-29" data-month="2025-12" data-outside="true"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="lundi 29 décembre 2025">29</button></td><td class="rdp-day rdp-outside" role="gridcell" data-day="2025-12-30" data-month="2025-12" data-outside="true"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mardi 30 décembre 2025">30</button></td><td class="rdp-day rdp-outside" role="gridcell" data-day="2025-12-31" data-month="2025-12" data-outside="true"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mercredi 31 décembre 2025">31</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-01"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="jeudi 1 janvier 2026">1</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-02"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="vendredi 2 janvier 2026">2</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-03"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="samedi 3 janvier 2026">3</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-04"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="dimanche 4 janvier 2026">4</button></td></tr><tr class="rdp-week"><td class="rdp-day" role="gridcell" data-day="2026-01-05"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="lundi 5 janvier 2026">5</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-06"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mardi 6 janvier 2026">6</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-07"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mercredi 7 janvier 2026">7</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-08"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="jeudi 8 janvier 2026">8</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-09"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="vendredi 9 janvier 2026">9</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-10"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="samedi 10 janvier 2026">10</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-11"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="dimanche 11 janvier 2026">11</button></td></tr><tr class="rdp-week"><td class="rdp-day" role="gridcell" data-day="2026-01-12"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="lundi 12 janvier 2026">12</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-13"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mardi 13 janvier 2026">13</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-14"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mercredi 14 janvier 2026">14</button></td><td class="rdp-day rdp-selected" role="gridcell" aria-selected="true" data-day="2026-01-15" data-selected="true"><button class="rdp-day_button" type="button" tabindex="0" aria-label="jeudi 15 janvier 2026, sélectionné">15</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-16"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="vendredi 16 janvier 2026">16</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-17"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="samedi 17 janvier 2026">17</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-18"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="dimanche 18 janvier 2026">18</button></td></tr><tr class="rdp-week"><td class="rdp-day" role="gridcell" data-day="2026-01-19"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="lundi 19 janvier 2026">19</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-20"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mardi 20 janvier 2026">20</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-21"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mercredi 21 janvier 2026">21</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-22"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="jeudi 22 janvier 2026">22</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-23"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="vendredi 23 janvier 2026">23</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-24"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="samedi 24 janvier 2026">24</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-25"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="dimanche 25 janvier 2026">25</button></td></tr><tr class="rdp-week"><td class="rdp-day" role="gridcell" data-day="2026-01-26"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="lundi 26 janvier 2026">26</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-27"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mardi 27 janvier 2026">27</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-28"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="mercredi 28 janvier 2026">28</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-29"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="jeudi 29 janvier 2026">29</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-30"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="vendredi 30 janvier 2026">30</button></td><td class="rdp-day" role="gridcell" data-day="2026-01-31"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="samedi 31 janvier 2026">31</button></td><td class="rdp-day rdp-outside" role="gridcell" data-day="2026-02-01" data-month="2026-02" data-outside="true"><button class="rdp-day_button" type="button" tabindex="-1" aria-label="dimanche 1 février 2026">1</button></td></tr></tbody></table></div></div></div></div><div style="display: contents;"></div></span>"
    `);
  });
});
