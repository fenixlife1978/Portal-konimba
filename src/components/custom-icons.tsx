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


export const IconPublisher = ({ className }: { className?: string }) => (
  <IconWrapper className={className}>
    <circle cx="24" cy="24" r="24" className="fill-current opacity-20" />
    <path d="M24 15C21.2386 15 19 17.2386 19 20C19 22.7614 21.2386 25 24 25C26.7614 25 29 22.7614 29 20C29 17.2386 26.7614 15 24 15Z" fill="hsl(var(--primary-foreground))" />
    <path d="M16 34C16 30.134 19.5817 27 24 27C28.4183 27 32 30.134 32 34H16Z" fill="hsl(var(--primary-foreground))" />
  </IconWrapper>
);

export const IconLead = ({ className }: { className?: string }) => (
  <IconWrapper className={className}>
    <circle cx="24" cy="24" r="24" className="fill-current opacity-20" />
    <circle cx="24" cy="24" r="9" stroke="hsl(var(--primary-foreground))" strokeWidth="3" />
    <circle cx="24" cy="24" r="3" fill="hsl(var(--primary-foreground))" />
  </IconWrapper>
);

export const IconPayment = ({ className }: { className?: string }) => (
  <IconWrapper className={className}>
    <circle cx="24" cy="24" r="24" className="fill-current opacity-20" />
    <rect x="12" y="16" width="24" height="16" rx="3" fill="hsl(var(--primary-foreground))" />
    <rect x="14" y="26" width="10" height="3" rx="1.5" fill="hsl(var(--card))" />
  </IconWrapper>
);

export const IconOffer = ({ className }: { className?: string }) => (
  <IconWrapper className={className}>
    <circle cx="24" cy="24" r="24" className="fill-current opacity-20" />
    <path d="M15 13L33 13C34.1046 13 35 13.8954 35 15L35 24L24 35L13 24L15 13Z" fill="hsl(var(--primary-foreground))" />
    <circle cx="29" cy="18" r="2" fill="hsl(var(--card))" />
  </IconWrapper>
);

export const IconReport = ({ className }: { className?: string }) => (
  <IconWrapper className={className}>
    <circle cx="24" cy="24" r="24" className="fill-current opacity-20" />
    <path d="M16 32V24H12V32H16ZM26 32V16H22V32H26ZM36 32V20H32V32H36Z" fill="hsl(var(--primary-foreground))" />
  </IconWrapper>
);

export const IconPerformance = ({ className }: { className?: string }) => (
  <IconWrapper className={className}>
    <circle cx="24" cy="24" r="24" className="fill-current opacity-20" />
    <path d="M13 32L21 22L28 28L35 18" stroke="hsl(var(--primary-foreground))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M30 18H35V23" stroke="hsl(var(--primary-foreground))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </IconWrapper>
);

export const IconSettings = ({ className }: { className?: string }) => (
  <IconWrapper className={className}>
    <circle cx="24" cy="24" r="24" className="fill-current opacity-20" />
    <path d="M29.5858 18.4142C30.3668 19.1953 30.3668 20.4616 29.5858 21.2426L26.7574 24.0711L23.9289 21.2426L26.7574 18.4142C27.5384 17.6332 28.8047 17.6332 29.5858 18.4142Z" fill="hsl(var(--primary-foreground))" />
    <path d="M21.2426 29.5858C20.4616 30.3668 19.1953 30.3668 18.4142 29.5858L15 26.1716L21.8284 19.3431L26.1716 23L21.2426 29.5858Z" fill="hsl(var(--primary-foreground))" />
    <path d="M33.8284 26.1716L26.1716 33.8284L23 30.6569L30.6569 23L33.8284 26.1716Z" fill="hsl(var(--primary-foreground))" />
    <path d="M19.3431 21.8284L13 28.1716L14.8284 30L21.1716 23.6569L19.3431 21.8284Z" fill="hsl(var(--primary-foreground))" />
  </IconWrapper>
);
