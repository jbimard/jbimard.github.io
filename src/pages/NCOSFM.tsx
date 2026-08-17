import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import inspectorCover from "/images/Covers/Inspector-cover.webp";

import InspectorHome from "/images/projectsImg/homePage.webp";
import githubIssues from "/images/projectsImg/githubIssues.webp";
import inspectorList from "/images/projectsImg/inspectorList.webp";
import inspectorModal from "/images/projectsImg/inspectorModal.webp";
import inspectorTool from "/images/projectsImg/inspectorTool.webp";
import adminLogin from "/images/projectsImg/adminLogin.webp";

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2
    className="text-black font-extrabold tracking-tight leading-none
                 text-4xl sm:text-5xl md:text-5xl lg:text-6xl xl:text-[70px]"
  >
    {children}
  </h2>
);

const TwoCol = ({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,700px),minmax(0,1fr)] gap-8 lg:gap-16 items-start mt-6 lg:mt-40">
    {left}
    {right}
  </div>
);

const NCOSFM = () => {
  return (
    <main className="w-screen overflow-x-hidden bg-white">
      <section className="relative" id="nc-osfm">
        <div
          className="relative"
          style={{ marginTop: "calc(env(safe-area-inset-top) * -1)" }}
        >
          {/* Navbar over the cover with transparent background */}
          <div
            className="absolute inset-x-0 top-0 z-20"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <Navbar transparent={true} />
          </div>
          <img
            src={inspectorCover}
            alt="Enterprise network simulation cover"
            className="w-full h-[380px] sm:h-[520px] md:h-[680px] lg:h-[820px] xl:h-[700px] object-cover"
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
                    NC OSFM <br /> Licensed Inspector Lookup Platform
                  </span>
                </SectionHeading>
              }
              right={
                <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
                  <p>
                    This project focused on designing and developing a
                    full-stack web platform prototype to improve how licensed
                    inspectors are located across North Carolina. Working as
                    part of a capstone team, we partnered with stakeholders from
                    the North Carolina Office of State Fire Marshal (OSFM) to
                    explore how a centralized, user-friendly system could make
                    inspector information more accessible to the public,
                    contractors, and internal staff.
                  </p>
                  <p>
                    The platform enables users to search, filter, and review
                    certified inspectors by city, county, trade, and
                    certification through a clean, intuitive interface. Emphasis
                    was placed on usability, accessibility, and visual
                    consistency with North Carolina government design standards
                    to ensure the tool would feel familiar and trustworthy to
                    end users. The system also demonstrates how inspector
                    details such as jurisdiction, license status, and contact
                    information can be presented clearly and efficiently.
                  </p>
                  <p>
                    Beyond the public-facing experience, the project includes a
                    conceptual administrative workflow illustrating how
                    inspector records could be managed internally. While
                    implemented as an academic prototype using sample data, the
                    design reflects real-world public-sector constraints,
                    including data integrity, scalability, and secure system
                    architecture.
                  </p>
                </div>
              }
            />

            <TwoCol
              left={
                <SectionHeading>
                  <span className="leading-tight font-normal">
                    Build & Test{" "}
                  </span>
                </SectionHeading>
              }
              right={
                <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 font-light">
                  <p>
                    The application was implemented as a full-stack prototype
                    using modern web technologies. The frontend supports dynamic
                    searching, filtering, and responsive layouts, while the
                    backend API and database were structured to simulate
                    realistic inspector records and query behavior. This
                    approach allowed the team to validate functionality and
                    demonstrate practical use cases without integrating with
                    live OSFM systems.
                  </p>
                  <p>
                    The completed prototype was reviewed with OSFM stakeholders,
                    who provided feedback on clarity, usability, and alignment
                    with organizational needs. A recorded walkthrough was
                    created to present the platform's features and workflow,
                    serving as a proof of concept for how modern web solutions
                    can improve access to state-level services.
                  </p>

                  <br></br>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      Focus Areas: Full-stack development, public-sector
                      systems, UI/UX design, secure data handling, stakeholder
                      collaboration
                    </li>
                    <li>
                      Technologies: Angular, Spring Boot, MongoDB, REST APIs
                    </li>
                  </ul>

                  <br></br>

                  <p>
                    Video Demo:{" "}
                    <a
                      href="https://www.youtube.com/watch?v=o9GgqUrwWhY"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      YouTube – NC OSFM Licensed Inspector Lookup Platform
                    </a>
                  </p>
                </div>
              }
            />
          </div>
          <div className="mt-12 lg:mt-16 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <img
              src={InspectorHome}
              alt="NC OSFM home page"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={githubIssues}
              alt="NC OSFM GitHub issues board"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[400px] object-cover lg:object-contain"
            />
            <img
              src={inspectorTool}
              alt="NC OSFM inspector tool"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={inspectorList}
              alt="NC OSFM inspector list"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={inspectorModal}
              alt="NC OSFM inspector modal"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={adminLogin}
              alt="NC OSFM admin login"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default NCOSFM;
