import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { Outlet, useLocation } from 'react-router-dom'

export default function Root() {
  const location = useLocation();
  
  // Pages where background should be black
  const darkPages = ["/about", "/projects"];
  const isDark = darkPages.includes(location.pathname);

  return (
    <div className={isDark ? "bg-black text-white" : "bg-white text-black"}>
      <Navbar dark={isDark} onJump={function (): void {
              throw new Error('Function not implemented.');
          } } />
      <main>
        <Outlet />
      </main>
      <Footer/>
    </div>
  );
}