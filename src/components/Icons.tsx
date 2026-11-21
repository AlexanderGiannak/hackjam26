type P = { className?: string };
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export const SearchIcon = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className} aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const BoxIcon = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className} aria-hidden><rect x="3" y="8" width="18" height="12" rx="1.5" /><path d="M3 12h18M12 8v12M7 8V5h10v3" /></svg>
);
export const WrenchIcon = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className} aria-hidden><path d="M14.7 6.3a4 4 0 0 0 5 5L22 9a6 6 0 0 1-8-8l-2.3 2.3a4 4 0 0 0 3 3Z" transform="translate(-1 1)" /><path d="m13 11-9 9a1.5 1.5 0 0 0 2 2l9-9" /></svg>
);
export const UploadIcon = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className} aria-hidden><path d="M12 15V3m0 0-4 4m4-4 4 4" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>
);
export const ImageIcon = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className} aria-hidden><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
);
export const PinIcon = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} className={className} aria-hidden><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg>
);
export const ClockIcon = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} className={className} aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const SendIcon = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} className={className} aria-hidden><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></svg>
);
export const CheckIcon = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} strokeWidth={3} className={className} aria-hidden><path d="m5 12 5 5 9-10" /></svg>
);
export const ChevronRight = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} className={className} aria-hidden><path d="m9 6 6 6-6 6" /></svg>
);
export const PhoneIcon = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} className={className} aria-hidden><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" /></svg>
);
export const LinkIcon = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} className={className} aria-hidden><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
);
export const SparkIcon = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} className={className} aria-hidden><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>
);
