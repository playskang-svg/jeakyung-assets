const paths = {
  dashboard: 'M4 4h6v6H4V4Zm10 0h6v4h-6V4ZM4 14h6v6H4v-6Zm10-2h6v8h-6v-8Z',
  mail: 'M3 5h18v14H3V5Zm2 2v.3l7 5.2 7-5.2V7H5Zm14 10V9.8l-7 5.1-7-5.1V17h14Z',
  organization: 'M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM5 13a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm14 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-7-2c3 0 5.5 1.4 6.2 3.3l-2 .7c-.4-1.1-2.1-2-4.2-2s-3.8.9-4.2 2l-2-.7C6.5 12.4 9 11 12 11Z',
  boards: 'M4 4h16v16H4V4Zm2 3v2h12V7H6Zm0 5v2h8v-2H6Zm0 5h12v-2H6v2Z',
  approval: 'M7 3h10v3h3v15H4V6h3V3Zm2 2v2h6V5H9Zm-1 7 2.5 2.5L16 9l1.5 1.5-7 7L6.5 13.5 8 12Z',
  calendar: 'M5 3h2v2h10V3h2v2h2v16H3V5h2V3Zm14 7H5v9h14v-9ZM5 7v1h14V7H5Z',
  files: 'M4 3h7l2 2h7v16H4V3Zm2 4v12h12V7h-6l-2-2H6v2Z',
  admin: 'M12 2 4 5v6c0 5 3.4 9.5 8 11 4.6-1.5 8-6 8-11V5l-8-3Zm0 3 5 1.9V11c0 3.5-2 6.7-5 8-3-1.3-5-4.5-5-8V6.9L12 5Zm0 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm-3 8c.5-1.3 1.6-2 3-2s2.5.7 3 2H9Z',
};

export default function NavigationIcon({ name }) {
  return (
    <svg className="gw-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name] ?? paths.dashboard} />
    </svg>
  );
}
