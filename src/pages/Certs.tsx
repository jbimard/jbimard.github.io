import React, { useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import pythonCover from "/images/Covers/Python-cover.jpg";


import mastercard1Img from "/images/certsImg/ForageMastercard.png";
import mastercard2Img from "/images/certsImg/MastercardCert.png";

import python1Img from "/images/certsImg/PythonCert.png";
import python2Img from "/images/certsImg/Courserainfo.png";



const SectionHeading = ({children}:{children:React.ReactNode}) => (
  <h2 className="text-black font-extrabold tracking-tight leading-none
                 text-4xl sm:text-5xl md:text-5xl lg:text-6xl xl:text-[70px]">
    {children}
  </h2>
);

const TwoCol = ({left,right}:{left:React.ReactNode; right:React.ReactNode}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,700px),minmax(0,1fr)] gap-8 lg:gap-16 items-start mt-6 lg:mt-40">
    {left}
    {right}
  </div>
);

export const Work = () => {
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash?.slice(1);
      if (!hash) return;
      const el = document.getElementById(hash);
      if (!el) return;

      // Offset so headings aren’t hidden under the navbar/overlay
      let OFFSET;
      if (window.innerWidth < 640) {
        OFFSET = -40;
      } else {
        OFFSET = -60;
      }
      const y = el.getBoundingClientRect().top + window.pageYOffset - OFFSET;
      window.scrollTo({ top: y, behavior: 'smooth' });
    };

    // initial scroll after first paint
    requestAnimationFrame(scrollToHash);

    // handle in-page hash changes
    const onHashChange = () => scrollToHash();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return (
    <main className="w-screen overflow-x-hidden bg-white">
        
      {/* Mastercard Cybersecurity Job Simulation */}
      <section className="relative" id="mastercard">
        
        <div className="relative" style={{ marginTop: "calc(env(safe-area-inset-top) * -1)" }}>
          {/* Navbar over the cover with transparent background */}
          <div className="absolute inset-x-0 top-0 z-20" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <Navbar transparent={true} />
          </div>
          <img
            alt="Lecture hall cover"
            className="w-full h-[380px] sm:h-[520px] md:h-[680px] lg:h-[820px] xl:h-[700px] object-cover"
            src="/images/Covers/Mastercard-cover.jpg"
          />
        </div>

        <div
          className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 mt-0 lg:-mt-32 pb-16 md:pb-24"
          style={{ marginTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}
        >
          <div className="lg:-mt-24">
            <TwoCol
              left={
          <SectionHeading>
            <span className="leading-tight">
              Mastercard Cybersecurity Job Simulation
            </span>
          </SectionHeading>
              }
              right={
                <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
                  <p>
                    On January 6th, 2025, I completed the Mastercard Cybersecurity Job Simulation offered through Forage, an interactive program designed to replicate real-world challenges faced by security professionals. This experience provided hands-on exposure to identifying potential threats, analyzing security incidents, and applying best practices for safeguarding sensitive data in a corporate environment. The simulation focused on practical, scenario-based problem solving, which strengthened my ability to think critically under pressure and approach security challenges with a structured, investigative mindset.                  </p>
                  <p>
                    Through this simulation, I gained experience in assessing vulnerabilities, preparing incident reports, and recommending mitigation strategies. I also learned how to evaluate cyber risks in relation to business priorities, reinforcing my ability to apply cybersecurity skills in realistic, professional scenarios.                  </p>
                </div>
              }
            />
          </div>
          <div className="mt-12 lg:mt-16 flex flex-col lg:flex-row gap-4 lg:gap-6">
            <img
              src={mastercard1Img}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={mastercard2Img}
              alt="TA screenshot 2"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[400px] object-cover lg:object-contain lg:mt-50"
            />
          </div>
        </div>
      </section>

      {/* Python Data Structures */}
      <section className="relative pt-24" id="python">
        <img src={pythonCover} alt="Research cover" className="w-full h-[380px] sm:h-[520px] md:h-[680px] lg:h-[820px] xl:h-[700px] object-cover" />
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 mt-6 lg:-mt-32 pb-16 md:pb-24">
          <TwoCol
            left={<SectionHeading>Python Data Structures</SectionHeading>}
            right={
              <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
                <p>
                  In 2022, I earned the Python Data Structures certification through Coursera, offered by the University of Michigan. This course provided a focused exploration of Python’s core data structures, including lists, dictionaries, tuples, and strings, as well as the practical use of functions and loops for data processing. The program emphasized writing efficient, readable code while developing a solid understanding of how data is stored, accessed, and manipulated in Python.                </p>
                <p>
                  Completing this course strengthened my ability to build and optimize Python programs by selecting the most effective data structures for each task. These skills are directly applicable to software development, automation, and cybersecurity scripting, where Python is frequently used for tasks like data parsing, log analysis, and security tool development.                </p>
              </div>
            }
          />
          <div className="mt-12 lg:mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-0 items-start">
            <img src={python1Img} alt="RA fig 1" className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[full] object-cover lg:object-contain lg:ml-30" />
            <img src={python2Img} alt="RA fig 2" className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[full] object-cover lg:object-contain" />
          </div>
        </div>
      </section>

       <Footer />
    </main>
  );
};

export default Work;