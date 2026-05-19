// @types/bun 1.3.x declares `fetch` and `RequestInit` but omits the
// DOM-canonical `RequestInfo` alias (Request | string). Story 3-3's
// frankfurter-client.test.ts references it verbatim per the Fetch spec —
// we mirror the DOM definition here rather than pulling `lib: ["DOM"]` and
// polluting the api project with the rest of the browser globals.

declare type RequestInfo = Request | string;
