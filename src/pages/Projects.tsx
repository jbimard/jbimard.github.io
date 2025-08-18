import React, { useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";


import CityDiagram from "/images/projectsImg/City-Diagram.png";
import HRoffcie from "/images/projectsImg/HR-office.png";
import logicDiagram from "/images/projectsImg/Logic-Diagram.png";
import RoutetIT from "/images/projectsImg/Router-IT.png";
import PCcommand from "/images/projectsImg/PC-command.png";
import CableManagement from "/images/projectsImg/Cable-management.png";
import IToffice from "/images/projectsImg/IT-office.png";
import DHCP from "/images/projectsImg/DHCP.png";







const SectionHeading = ({children}:{children:React.ReactNode}) => (
  <h2 className="text-black font-extrabold tracking-tight leading-none
                 text-4xl sm:text-5xl md:text-5xl lg:text-6xl xl:text-[70px]">
    {children}
  </h2>
);

const TwoCol = ({
  left,
  right,
  className,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,700px),minmax(0,1fr)] gap-8 lg:gap-16 items-start mt-6 lg:mt-40 ${className || ""}`}
  >
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
            src="/images/Covers/Cisco-cover.jpg"
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
              Enterprise Office Network Simulation
            </span>
          </SectionHeading>
              }
              right={
                <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
                  <p>
                    This project focused on designing and implementing a complete network infrastructure for a medium-sized organization with two office locations, the IT department and the HR department. The network was structured to provide both wired and wireless connectivity, ensuring reliable communication between devices and departments while maintaining security through VLAN segmentation. Core components such as routers, switches, wireless LAN controllers, and access points were configured to support day-to-day operations, while essential services like DHCP, DNS, and file sharing were implemented to centralize and streamline resource management.
                  </p>
                  <p>
                    In addition to connectivity, the project emphasized scalability and security. Logical and physical diagrams were created to document the design, making future troubleshooting and expansion easier. Access control lists (ACLs), wireless encryption, and firewall rules were incorporated to safeguard the network against unauthorized access. Overall, the design demonstrates a strong balance of functionality, efficiency, and security within a professional IT setting.
                  </p>
                  <p>
                    If you want access to the Packet Tracer file, you can find it on my <a href="https://github.com/jbimard/jbimard.github.io/blob/main/src/images/projectsImg/Packet-Tracer-File.pkt">GitHub</a>.
                  </p>
                  <p>
                    If you are looking for the documentation that was specifically prepared and targeted for the company, you can find it in the attached file:
                    <a href="/files/Network Infrastructure Project Documentation.pdf" target="_blank" className="underline">
                      &nbsp;Network Infrastructure Project Documentation.pdf
                    </a>.
                  </p>
                </div>
              }
            />

            <TwoCol 
            
            left={
                  <SectionHeading>
                    <span className="leading-tight font-normal">
                      Simulation 
                    </span>
                  </SectionHeading>
                }
                right={
                  <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
                    <p>
                      To bring this design to life, the network was fully simulated in Cisco Packet Tracer, providing a hands-on environment to test configurations, troubleshoot connections, and validate system performance. This simulation included setting up IP addressing schemes, configuring VLANs for segmentation, and ensuring that both wired and wireless devices could communicate effectively across the IT and HR offices. By running the infrastructure virtually, I was able to replicate real-world IT challenges, such as managing device roles, configuring routing, and optimizing performance through DHCP, DNS, and access control rules.
                    </p>
                    <p>
                      Working with Packet Tracer offered valuable IT experience by simulating the responsibilities of a network administrator. It required applying critical thinking and problem-solving skills to address issues like misconfigured ports, faulty device connections, and improper addressing. This hands-on practice is essential for building the skills needed in real-world IT environments, preparing me for situations where designing, deploying, and securing enterprise-level networks are crucial.
                    </p>
                  </div>
                }
              />
          </div>
            <div className="mt-12 lg:mt-16 grid grid-cols-2 gap-4 lg:gap-6">
            <img
              src={HRoffcie}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={CityDiagram}
              alt="TA screenshot 2"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[400px] object-cover lg:object-contain"
            />
            <img
              src={logicDiagram}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={RoutetIT}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={PCcommand}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={CableManagement}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={IToffice}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={DHCP}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
          </div>
        </div>
      </section>

       <Footer />
    </main>
  );
};

export default Work;