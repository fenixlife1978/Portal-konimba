import React from 'react';

const iconProps: React.SVGProps<SVGSVGElement> = {
  width: "48",
  height: "48",
  viewBox: "0 0 48 48",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg"
};

const IconWrapper = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <svg {...iconProps} className={className}>{children}</svg>
);

const TwoToneCircle = ({ color1, color2 }: { color1: string, color2: string }) => (
  <>
    <circle cx="24" cy="24" r="22" fill={color1} />
    <path d="M24 2C36.1503 2 46 11.8497 46 24C46 36.1503 36.1503 46 24 46V2Z" fill={color2} />
  </>
)

export const IconPublisher = () => (
  <IconWrapper>
    <TwoToneCircle color1="hsl(var(--chart-1))" color2="hsl(var(--chart-1) / 0.7)" />
    <path d="M24 15C21.2386 15 19 17.2386 19 20C19 22.7614 21.2386 25 24 25C26.7614 25 29 22.7614 29 20C29 17.2386 26.7614 15 24 15Z" fill="white" />
    <path d="M16 34C16 30.134 19.5817 27 24 27C28.4183 27 32 30.134 32 34H16Z" fill="white" />
  </IconWrapper>
);

export const IconLead = () => (
  <IconWrapper>
    <TwoToneCircle color1="hsl(var(--chart-2))" color2="hsl(var(--chart-2) / 0.7)" />
    <circle cx="24" cy="24" r="9" stroke="white" strokeWidth="3" />
    <circle cx="24" cy="24" r="3" fill="white" />
  </IconWrapper>
);

export const IconPayment = () => (
  <IconWrapper>
    <TwoToneCircle color1="hsl(var(--chart-3))" color2="hsl(var(--chart-3) / 0.7)" />
    <rect x="12" y="16" width="24" height="16" rx="3" fill="white" />
    <rect x="14" y="26" width="10" height="3" rx="1.5" fill="hsl(var(--chart-3))" />
  </IconWrapper>
);

export const IconOffer = () => (
  <IconWrapper>
    <TwoToneCircle color1="hsl(var(--chart-4))" color2="hsl(var(--chart-4) / 0.7)" />
    <path d="M15 13L33 13C34.1046 13 35 13.8954 35 15L35 24L24 35L13 24L15 13Z" fill="white" />
    <circle cx="29" cy="18" r="2" fill="hsl(var(--chart-4))" />
  </IconWrapper>
);

export const IconReport = () => (
  <IconWrapper>
    <TwoToneCircle color1="hsl(var(--chart-5))" color2="hsl(var(--chart-5) / 0.7)" />
    <path d="M16 32V24H12V32H16ZM26 32V16H22V32H26ZM36 32V20H32V32H36Z" fill="white" />
  </IconWrapper>
);

export const IconReceipt = () => (
  <IconWrapper>
    <TwoToneCircle color1="hsl(var(--chart-1))" color2="hsl(var(--chart-1) / 0.7)" />
    <path d="M16 13H32V35L28 32L24 35L20 32L16 35V13Z" fill="white" />
    <path d="M20 20H28" stroke="hsl(var(--chart-1))" strokeWidth="2" strokeLinecap="round" />
    <path d="M20 25H25" stroke="hsl(var(--chart-1))" strokeWidth="2" strokeLinecap="round" />
  </IconWrapper>
);

export const IconPending = () => (
  <IconWrapper>
    <TwoToneCircle color1="hsl(var(--chart-1))" color2="hsl(var(--chart-1) / 0.7)" />
    <path d="M18 16L30 16L28 24H20L18 16Z" fill="white" />
    <path d="M20 28L28 28L30 32H18L20 28Z" fill="white" />
    <path d="M24 16V13" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <path d="M24 35V32" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </IconWrapper>
);

export const IconHistory = () => (
  <IconWrapper>
    <TwoToneCircle color1="hsl(var(--chart-2))" color2="hsl(var(--chart-2) / 0.7)" />
    <path d="M24 14V24H32" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16.458 31.542C18.9331 33.7222 22.2592 35 26 35C33.1797 35 39 29.1797 39 22C39 14.8203 33.1797 9 26 9C23.9573 9 22.0334 9.40395 20.3223 10.124" stroke="white" strokeWidth="3" strokeLinecap="round" />
    <path d="M18 9L15 13L19 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </IconWrapper>
);

export const IconPerformance = () => (
  <IconWrapper>
    <TwoToneCircle color1="hsl(var(--chart-4))" color2="hsl(var(--chart-4) / 0.7)" />
    <path d="M13 32L21 22L28 28L35 18" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M30 18H35V23" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </IconWrapper>
);

export const IconSettings = () => (
  <IconWrapper>
    <TwoToneCircle color1="hsl(var(--chart-5))" color2="hsl(var(--chart-5) / 0.7)" />
    <path d="M29.5858 18.4142C30.3668 19.1953 30.3668 20.4616 29.5858 21.2426L26.7574 24.0711L23.9289 21.2426L26.7574 18.4142C27.5384 17.6332 28.8047 17.6332 29.5858 18.4142Z" fill="white" />
    <path d="M21.2426 29.5858C20.4616 30.3668 19.1953 30.3668 18.4142 29.5858L15 26.1716L21.8284 19.3431L26.1716 23L21.2426 29.5858Z" fill="white" />
    <path d="M33.8284 26.1716L26.1716 33.8284L23 30.6569L30.6569 23L33.8284 26.1716Z" fill="white" />
    <path d="M19.3431 21.8284L13 28.1716L14.8284 30L21.1716 23.6569L19.3431 21.8284Z" fill="white" />
  </IconWrapper>
);
