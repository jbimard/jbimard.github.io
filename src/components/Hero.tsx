import { useState, useEffect, useRef } from 'react';

const cards = [
  { src: '/images/Covers/ComingSoon-icon.webp', alt: 'Coming Soon', title: 'Coming Soon', href: '/comingsoon', logoCard: true },
  { src: '/images/Covers/TrueHomes-logo.svg', alt: 'True Homes', title: 'True Homes', href: '/truehomes', logoCard: true },
  { src: '/images/Covers/TA-cover.webp', alt: 'University of North Carolina at Charlotte', title: 'University of North Carolina at Charlotte', href: '/unccharlotte' },
  { src: '/images/Covers/ConoceTuProfesor-logo.webp', alt: 'Conoce Tu Profesor', title: 'Conoce Tu Profesor', href: '/conocetuprofesor', logoCard: true },
  { src: '/images/Covers/Inspector-cover.webp', alt: 'NC OSFM', title: 'NC OSFM', href: '/ncosfm' },
  { src: '/images/Covers/cowrie-honeypot.webp', alt: 'Cowrie Honeypot', title: 'Cowrie Honeypot', href: '/cowriehoneypot' },
];

const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches);

const isIPad = () => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  // iPadOS 13+ identifies as Mac but with touch points
  const isIPadOS13Up = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  const isIPadUA = /iPad/.test(ua);
  return isIPadOS13Up || isIPadUA;
};

// Treat wider touch devices as tablet-like (covers many emulations)
const isTabletLike = () =>
  typeof window !== 'undefined' &&
  isTouchDevice() &&
  window.innerWidth >= 768 && window.innerWidth <= 1366;

const Card = ({ src, alt, title, href, logoCard }: { src?: string; alt: string; title: string; href?: string; logoCard?: boolean }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  // Detect device capabilities and size
  useEffect(() => {
    const update = () => {
      const touch = isTouchDevice();
      setIsTouch(touch);
      setIsPhone(touch && window.innerWidth < 768);
      setIsTablet(isIPad() || isTabletLike());
    };

    update();

    const mqHover = window.matchMedia('(hover: none)');
    const mqPointer = window.matchMedia('(pointer: coarse)');
    mqHover.addEventListener?.('change', update);
    mqPointer.addEventListener?.('change', update);
    window.addEventListener('resize', update);

    return () => {
      mqHover.removeEventListener?.('change', update);
      mqPointer.removeEventListener?.('change', update);
      window.removeEventListener('resize', update);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Phones: reveal overlay based on scroll visibility
  useEffect(() => {
    if (!isPhone || !cardRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.intersectionRatio > 0.5),
      { threshold: [0, 0.5, 1], rootMargin: '-10% 0px -10% 0px' }
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [isPhone]);

  // Tap handling
  const onTouchClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    if (!isTouch) return;

    // Tablet/iPad: first tap shows, auto-hide after 3s; second tap within 3s navigates
    if (isTablet) {
      if (!isVisible) {
        e.preventDefault();
        setIsVisible(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = window.setTimeout(() => {
          setIsVisible(false);
          hideTimeoutRef.current = null;
        }, 3000);
      }
      return; // when visible, allow navigation
    }

    // Phones: if overlay not visible yet, show it and prevent nav; scroll observer manages hiding
    if (!isVisible) {
      e.preventDefault();
      setIsVisible(true);
    }
  };

  if (!href) {
    return (
      <figure className="relative w-full aspect-[2/3] border border-black/0 bg-neutral-900 flex items-center justify-center p-6">
        <div className="text-center text-white max-w-md">
          <h3 className="font-semibold text-xl md:text-2xl tracking-tight">{title}</h3>
          <p className="mt-2 text-sm text-white/60">Coming soon</p>
        </div>
      </figure>
    );
  }

  return (
    <figure
      ref={cardRef as any}
      className="relative w-full aspect-[2/3] border border-black/0 bg-white group touch-overlay"
    >
      <a
        href={href}
        onClick={onTouchClick}
        className="block relative w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-black/50"
      >
        {logoCard ? (
          <div className="w-full h-full bg-neutral-100 flex items-center justify-center p-10">
            <img src={src} alt={alt} loading="lazy" className="max-w-[70%] max-h-[45%] w-auto h-auto object-contain" />
          </div>
        ) : (
          <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" />
        )}
        <div
          className={`overlay absolute inset-0 flex items-center justify-center p-6 bg-black/70 transition-opacity duration-300 ${
            isTouch
              ? isVisible
                ? 'opacity-100'
                : 'opacity-0'
              : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
          }`}
        >
          <div className="text-center text-white max-w-md h-64 flex flex-col justify-center">
            <h3 className="font-semibold text-xl md:text-2xl tracking-tight">{title}</h3>
          </div>
        </div>
      </a>
    </figure>
  );
};

const Hero = () => {
  return (
    <section id="top" className="mx-auto max-w-7xl px-0 pt-12 md:pt-24">
      <h1 className="text-left font-medium leading-tight text-4xl md:text-8xl tracking-tight md:pb-10 ml-4 md:ml-0">
        Designing systems, securing
        what matters.
      </h1>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.alt} {...card} />
        ))}
      </div>
    </section>
  );
};

export default Hero;