import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

// If these image files live next to this file, these imports will work.
// If they live somewhere else, adjust the paths accordingly.
import mastercardCover from "/images/Covers/Mastercard-cover.webp";
import pythonCover from "/images/Covers/Python-cover.webp";


type CardProps = {
  title: string;
  href: string;
  bg: string; // url from imported image
};

const CoverCard: React.FC<CardProps> = ({ title, href, bg }) => {
  return (
    <a
      href={href}
      className="group relative block w-full overflow-hidden rounded-none focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
      aria-label={`${title} – jump to section`}
    >
      <div
        className="relative h-[200px] sm:h-[240px] md:h-[280px] lg:h-[300px] w-full bg-center bg-cover"
        style={{ backgroundImage: `url(${bg})` }}
      >
        <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>
        <div className="absolute inset-0 flex items-center translate-y-4 sm:translate-y-6">
          <span className="pl-6 sm:pl-8 md:pl-10 lg:pl-16 text-white font-semibold tracking-tight text-3xl sm:text-4xl md:text-7xl">
            {title}
          </span>
        </div>
      </div>
    </a>
  );
};

const WorkInterface: React.FC = () => {
  return (
    <main className="min-h-screen w-full">
      <Navbar />
      <section className="w-full px-0 pt-6 sm:pt-24">
        <div className="grid grid-cols-1 gap-y-10">
          <CoverCard title="Forage - Mastercard Cybersecurity" href="/Certs" bg={mastercardCover} />
          <CoverCard title="Coursera - Python Data Structures" href="/Certs#python" bg={pythonCover} />
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default WorkInterface;