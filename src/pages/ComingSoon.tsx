import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import comingSoonIcon from "/images/Covers/ComingSoon-icon.webp";

const ComingSoon: React.FC = () => {
  return (
    <main className="w-screen overflow-x-hidden bg-white">
      <Navbar />

      <section className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 py-24">
        <img
          src={comingSoonIcon}
          alt=""
          className="h-20 sm:h-24 md:h-28 w-auto object-contain"
        />
        <h1 className="mt-8 font-extrabold tracking-tight leading-none text-black text-4xl sm:text-5xl md:text-6xl">
          Coming Soon
        </h1>
        <p className="mt-4 text-black/60 text-base sm:text-lg md:text-xl max-w-md">
          A new project I'm currently building. Details are private for now,
          so check back once it's ready to share.
        </p>
      </section>

      <Footer />
    </main>
  );
};

export default ComingSoon;
