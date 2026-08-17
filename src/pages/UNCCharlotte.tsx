import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import RACover from "/images/Covers/RA-cover.webp";

import ta1Img from "/images/workImg/TA1img.webp";
import ta2Img from "/images/workImg/TA2img.webp";

import ra1Img from "/images/workImg/RA1img.webp";
import ra2Img from "/images/workImg/RA2img.webp";
import ra3Img from "/images/workImg/RA3img.webp";

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

const UNCCharlotte = () => {
  return (
    <main className="w-screen overflow-x-hidden bg-white">

      {/* Teacher Assistant */}
      <section className="relative" id="ta">

        <div className="relative" style={{ marginTop: "calc(env(safe-area-inset-top) * -1)" }}>
          {/* Navbar over the cover with transparent background */}
          <div className="absolute inset-x-0 top-0 z-20" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <Navbar transparent={true} />
          </div>
          <img
            alt="Lecture hall cover"
            className="w-full h-[380px] sm:h-[520px] md:h-[680px] lg:h-[820px] xl:h-[700px] object-cover"
            src="/images/Covers/TA-cover.webp"
          />
        </div>

        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 mt-0 lg:-mt-32 pb-16 md:pb-24" style={{ marginTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
          <div className="lg:-mt-24">
            <TwoCol
              left={<SectionHeading>Teacher Assistant</SectionHeading>}
              right={
                <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
                  <p>
                    In December of 2024, I began working as a Teaching Assistant for ITIS 3135 – Web-Based Application Design and Development at the University of North Carolina at Charlotte. In this course, I supported students as they explored the foundations of interactive web development, from HTML and CSS to DOM manipulation, event-driven programming, and web security fundamentals. My role extended beyond answering questions; I was actively involved in helping students bridge the gap between theory and practical implementation.
                  </p>
                  <p>
                    Throughout the 2024–2025 academic year, I guided students through their coding challenges, helped debug issues in real time, and provided feedback on both functionality and design. I collaborated with the lead instructor to clarify project expectations, reinforce accessibility standards, and introduce clean coding practices.
                  </p>
                  <p>
                    One of the most rewarding aspects of this role was seeing students gain confidence in building client-side interactions, particularly with asynchronous data handling (AJAX) and dynamic DOM manipulation. This experience not only sharpened my communication and mentoring skills but also deepened my technical proficiency in front-end development.
                  </p>
                </div>
              }
            />
          </div>
          {/* TA image stack */}
          <div className="mt-12 lg:mt-16 flex flex-col lg:flex-row gap-4 lg:gap-6">
            <img
              src={ta1Img}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={ta2Img}
              alt="TA screenshot 2"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[400px] object-cover lg:object-contain lg:mt-50"
            />
          </div>
        </div>
      </section>

      {/* Research Assistant */}
      <section className="relative pt-24" id="ra">
        <img src={RACover} alt="Research cover" className="w-full h-[380px] sm:h-[520px] md:h-[680px] lg:h-[820px] xl:h-[700px] object-cover" />
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 mt-6 lg:-mt-32 pb-16 md:pb-24">
          <TwoCol
            left={<SectionHeading>Research Assistant</SectionHeading>}
            right={
              <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
                <p>
                  In Fall 2024, I worked as a Research Assistant at the University of North Carolina at Charlotte under Dr. Meera Sridhar, focusing on formal models of exploits and the use of large language models (LLMs) to automate exploit generation, particularly in the context of IoT devices. My primary responsibility was conducting an in-depth literature review of over 50 academic papers, extracting the most impactful insights on vulnerability patterns, exploit primitives, and automated frameworks.
                </p>
                <p>
                  Throughout the semester, I synthesized complex technical information and shared key findings with Dr. Sridhar to inform the foundation of an upcoming survey paper. This experience strengthened my understanding of security research, formal modeling, and the intersection of AI and cybersecurity.
                </p>
              </div>
            }
          />
          {/* RA 3-column staggered images */}
          <div className="mt-12 lg:mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-0 items-start">
            <img src={ra1Img} alt="RA fig 1" className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain lg:mt-50" />
            <img src={ra2Img} alt="RA fig 2" className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain lg:mt-20" />
            <img src={ra3Img} alt="RA fig 3" className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"/>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default UNCCharlotte;
