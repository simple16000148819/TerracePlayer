const paths: Record<string, string> = {
  film: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 3v18M17 3v18M3 8h4m-4 8h4m10-8h4m-4 8h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  previous: '<path d="M6 5v14m12-14L8 12l10 7Z"/>',
  next: '<path d="M18 5v14M6 5l10 7-10 7Z"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  upload:
    '<path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  keyboard:
    '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M8 16h8"/>',
  volume:
    '<path d="M11 4 6 8H3v8h3l5 4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 4 6 8H3v8h3l5 4Zm5 5 5 6m0-6-5 6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  loop: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8a2.6 2.6 0 0 1 5 1c0 2-2.5 2-2.5 4m0 3h.01"/>',
};

export function icon(name: string, className = "") {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.film}</svg>`;
}
