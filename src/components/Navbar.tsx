import {useState} from 'react'
import { Link } from 'react-router-dom'

type Props = { 
  onJump?: (id: string) => void, 
  dark?: boolean,
  transparent?: boolean 
}

const Navbar = ({ dark, transparent }: Props) => {
  const [open, setOpen] = useState(false)
  
  // Determine background and text classes
  const getHeaderClasses = () => {
    if (transparent) {
      return 'bg-transparent text-white'; // transparent with white text for visibility over images
    }
    return dark ? 'bg-transparent text-white' : 'bg-white text-black';
  }
  
const getMobileMenuClasses = () => {
  if (transparent) {
    return 'bg-black/30 backdrop-blur-md border border-white/20 text-white'; // darker glass
  }
  return dark 
    ? 'bg-black/30 backdrop-blur-md border border-white/20 text-white' 
    : 'bg-white/80 backdrop-blur-md border border-black/20 text-black';
};

  return (
    <header className={getHeaderClasses()}>
      <div className="mx-auto max-w-7xl pt-18 flex items-center justify-between px-2 sm:px-0">
        <Link to="/" className="text-4xl leading-snug tracking-tight font-normal">
          Joseph Posas
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link to="/about" className="font-normal text-2xl hover:opacity-70">About</Link>
          <Link to="/workinterface" className="font-normal text-2xl hover:opacity-70">Work</Link>
          <Link to="/projectsinterface" className="font-normal text-2xl hover:opacity-70">Projects</Link>
          <Link to="/skills" className="font-normal text-2xl hover:opacity-70">Skills</Link>
          <Link to="/certsinterface" className="font-normal text-2xl hover:opacity-70">Certs</Link>
          <Link to="/goals" className="font-normal text-2xl hover:opacity-70">Goals</Link>
        </nav>
        <button 
          className={`md:hidden rounded-md px-3 py-2 border ${transparent ? 'border-white/20' : 'border-black/10'}`} 
          onClick={() => setOpen(!open)} 
          aria-label="Menu"
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      {open && (
        <div className={`md:hidden ${getMobileMenuClasses()} border-none shadow-none`}>
          <div className="mx-auto max-w-7xl px-4 py-3 grid gap-2">
            <Link to="/about" className="py-2 text-left" onClick={() => setOpen(false)}>About</Link>
            <Link to="/workinterface" className="py-2 text-left" onClick={() => setOpen(false)}>Work</Link>
            <Link to="/projectsinterface" className="py-2 text-left" onClick={() => setOpen(false)}>Projects</Link>
            <Link to="/skills" className="py-2 text-left" onClick={() => setOpen(false)}>Skills</Link>
            <Link to="/certsinterface" className="py-2 text-left" onClick={() => setOpen(false)}>Certs</Link>
            <Link to="/goals" className="py-2 text-left" onClick={() => setOpen(false)}>Goals</Link>
          </div>
        </div>
      )}
    </header>
  )
}

export default Navbar