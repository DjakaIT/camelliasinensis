// SVG ikone iz prototipa (engine.js / B3.html).
type P = { size?: number };
const base = (size: number, sw = 2) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: sw,
  'aria-hidden': true,
  focusable: false,
});

export const IconArrow = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconBack = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const IconPlus = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconCheck = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);
export const IconX = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconSearch = ({ size = 20 }: P) => (
  <svg {...base(size, 1.8)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);
export const IconFilter = ({ size = 18 }: P) => (
  <svg {...base(size, 1.8)}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);
export const IconThermo = ({ size = 22 }: P) => (
  <svg {...base(size, 1.5)}>
    <path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z" />
  </svg>
);
export const IconClock = ({ size = 22 }: P) => (
  <svg {...base(size, 1.5)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const IconScale = ({ size = 22 }: P) => (
  <svg {...base(size, 1.5)}>
    <path d="M6 20h12M12 4v16M5 8h14M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z" />
  </svg>
);
export const IconDone = ({ size = 40 }: P) => (
  <svg {...base(size, 1.6)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M7.5 12.5l3 3 6-6.5" />
  </svg>
);
export const IconWait = ({ size = 40 }: P) => (
  <svg {...base(size, 1.6)}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);
export const IconAlert = ({ size = 40 }: P) => (
  <svg {...base(size, 1.6)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 7v6M12 16.5v.5" />
  </svg>
);

export function CaffeineBars({ level }: { level: number }) {
  return (
    <span className="bars" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <i key={i} className={i < level ? 'f' : ''} />
      ))}
    </span>
  );
}

export function CaffeineDots({ level }: { level: number }) {
  return (
    <span className="x-dots" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <i key={i} className={i < level ? 'f' : ''} />
      ))}
    </span>
  );
}

export const IconInstagram = ({ size = 18 }: P) => (
  <svg {...base(size, 1.8)}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
  </svg>
);
export const IconTruck = ({ size = 20 }: P) => (
  <svg {...base(size, 1.5)}>
    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
    <circle cx="7" cy="17.5" r="1.5" />
    <circle cx="17" cy="17.5" r="1.5" />
  </svg>
);
export const IconCard = ({ size = 20 }: P) => (
  <svg {...base(size, 1.5)}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 10h18" />
  </svg>
);
export const IconReturn = ({ size = 20 }: P) => (
  <svg {...base(size, 1.5)}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
  </svg>
);
export const IconLeaf = ({ size = 22 }: P) => (
  <svg {...base(size, 1.5)}>
    <path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" />
    <path d="M5 19c3-4 6-7 10-9" />
  </svg>
);
export const IconGlobe = ({ size = 22 }: P) => (
  <svg {...base(size, 1.5)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
  </svg>
);
export const IconHand = ({ size = 22 }: P) => (
  <svg {...base(size, 1.5)}>
    <path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12" />
    <path d="M16 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3.5 15a1.6 1.6 0 0 1 2.6-1.9L7 14" />
  </svg>
);
export const IconPin = ({ size = 20 }: P) => (
  <svg {...base(size, 1.5)}>
    <path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);
export const IconPhone = ({ size = 20 }: P) => (
  <svg {...base(size, 1.5)}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
);
export const IconMail = ({ size = 20 }: P) => (
  <svg {...base(size, 1.5)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);
export const IconLock = ({ size = 18 }: P) => (
  <svg {...base(size, 1.6)}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
