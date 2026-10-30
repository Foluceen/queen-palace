/** Small inline icon set (no icon library dependency). Decorative unless labelled. */
const paths = {
  bag: "M6 8h12l-1 12H7L6 8Zm3 0a3 3 0 1 1 6 0",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4",
  menu: "M4 7h16M4 12h16M4 17h10",
  close: "M6 6l12 12M18 6 6 18",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  minus: "M6 12h12",
  lock: "M6 11h12v9H6v-9Zm3 0V8a3 3 0 0 1 6 0v3",
  plus: "M12 6v12M6 12h12",
  check: "m5 12 4 4 10-10",
  chevronLeft: "m15 6-6 6 6 6",
  chevronRight: "m9 6 6 6-6 6",
  chevronDown: "m6 9 6 6 6-6",
  star: "m12 4 2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9 12 4Z",
  truck: "M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6ZM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  trash: "M5 7h14M10 7V5h4v2m-7 0 1 13h8l1-13",
  grip: "M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01",
  dashboard: "M4 13h7V4H4v9Zm9 7h7V11h-7v9ZM4 20h7v-5H4v5Zm9-11h7V4h-7v5Z",
  box: "m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12v9M12 12 4 7.5",
  layers: "m12 4 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5",
  image: "M4 5h16v14H4V5Zm0 11 5-5 4 4 3-3 4 4M15 9h.01",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6",
  edit: "M4 20h4L19 9l-4-4L4 16v4Z",
  tag: "M3 12V4h8l10 10-8 8L3 12Zm5-4h.01",
  chat: "M4 5h16v11H8l-4 4V5Z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-3 2-1-2-4-2 1-2-1-1-2h-4L9 7 7 8 5 7l-2 4 2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1v-2Z",
  palette: "M12 3a9 9 0 0 0 0 18c1 0 1.5-.8 1-1.7-.7-1.2 0-2.3 1.3-2.3H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10ZM7.5 11h.01M10 7h.01M15 7h.01",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0 0-6m2 15a5 5 0 0 0-3-4.6",
  logout: "M10 5H5v14h5M14 8l4 4-4 4M9 12h9",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  upload: "M12 16V4m-5 5 5-5 5 5M4 20h16",
  arrowUp: "m6 15 6-6 6 6",
  arrowDown: "m6 9 6 6 6-6",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-13v2m0 14v2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17m10-10 1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z",
  monitor: "M3 5h18v11H3V5Zm6 15h6m-3-4v4",
  whatsapp: "M4 20l1.3-3.9A8 8 0 1 1 8 19l-4 1Zm5-11c0 3 3 6 6 6l1.3-1.4-2-1-1 .8a4 4 0 0 1-2.7-2.7l.8-1-1-2L9 9Z",
  play: "M8 5v14l11-7L8 5Z",
  mapPin: "M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  bolt: "M13 3 5 14h6l-1 7 8-11h-6l1-7Z",
  copy: "M8 8h11v11H8V8Zm-3 8V5h11",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H3",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2",
  file: "M6 3h8l4 4v14H6V3Zm8 0v4h4M9 12h6M9 16h6",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  sliders: "M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m4 0h0M14 4v4M8 10v4M16 16v4",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, label, className, strokeWidth = 1.6 }: { name: IconName; size?: number; label?: string; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      <path d={paths[name]} />
    </svg>
  );
}
