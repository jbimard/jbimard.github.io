import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  onJump?: (id: string) => void;
  dark?: boolean;
  transparent?: boolean;
};

const Navbar = ({ dark, transparent }: Props) => {
  const [open, setOpen] = useState(false);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => document.body.classList.remove('overflow-hidden');
  }, [open]);

  // Header color logic
  const getHeaderClasses = () => {
    if (transparent) return 'bg-transparent text-white';
    return dark ? 'bg-transparent text-white' : 'bg-white text-black';
  };

  // Mobile overlay background
  const getOverlayClasses = () => {
    if (transparent || dark) {
      return 'bg-white/95 text-black';
    }
    return 'bg-white text-black';
  };

  return (
    <header className={getHeaderClasses()}>
      <div className="mx-auto max-w-7xl py-4 flex items-center justify-between px-3 sm:px-0">
        <Link to="/" className="text-2xl md:text-4xl leading-snug tracking-tight font-normal">
          Joseph Posas
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link to="/about" className="font-normal text-2xl hover:opacity-70">About</Link>
          <Link to="/workinterface" className="font-normal text-2xl hover:opacity-70">Work</Link>
          <Link to="/projectsinterface" className="font-normal text-2xl hover:opacity-70">Projects</Link>
          <Link to="/skills" className="font-normal text-2xl hover:opacity-70">Skills</Link>
          <Link to="/certsinterface" className="font-normal text-2xl hover:opacity-70">Certs</Link>
          <Link to="/goals" className="font-normal text-2xl hover:opacity-70">Goals</Link>
        </nav>

        {/* Mobile trigger */}
        <button
          className={`md:hidden rounded-md px-3 py-2 border ${transparent ? 'border-white/20' : 'border-black/10'}`}
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          Menu
        </button>
      </div>

      {/* Mobile full-screen overlay menu */}
      {(
        <div
          className={`md:hidden fixed inset-0 z-50 ${getOverlayClasses()} ${
            open ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-2'
          } transition-all duration-200 ease-out`}
          aria-hidden={!open}
        >
          {/* Top bar with close button */}
          <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
            <span className="text-base">Joseph Posas</span>
            <button
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="h-9 w-9 grid place-items-center border border-black/20 rounded-md"
            >
              <span className="sr-only">Close</span>
              {/* X icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Centered menu list */}
          <div className="h-[calc(100vh-64px)] flex items-center justify-center">
            <ul className="text-center space-y-6">
              <li>
                <Link to="/workinterface" onClick={() => setOpen(false)} className="text-2xl">Work</Link>
              </li>
              <li>
                <Link to="/projectsinterface" onClick={() => setOpen(false)} className="text-2xl">Projects</Link>
              </li>
              <li>
                <Link to="/certsinterface" onClick={() => setOpen(false)} className="text-2xl">Certs</Link>
              </li>
              <li>
                <Link to="/about" onClick={() => setOpen(false)} className="text-2xl">About</Link>
              </li>
              <li>
                <Link to="/skills" onClick={() => setOpen(false)} className="text-2xl">Skills</Link>
              </li>
              <li>
                <Link to="/goals" onClick={() => setOpen(false)} className="text-2xl">Goals</Link>
              </li>
            </ul>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;