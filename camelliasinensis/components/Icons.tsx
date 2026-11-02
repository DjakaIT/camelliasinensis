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
