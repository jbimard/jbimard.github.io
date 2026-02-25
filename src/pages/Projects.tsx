import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

import ciscoCover from '/images/Covers/Cisco-cover.webp';
import tenableCover from '/images/Covers/Flag-cover.webp';
import inspectorCover from '/images/Covers/Inspector-cover.webp';

import CityDiagram from '/images/projectsImg/City-Diagram.webp';
import HRoffcie from '/images/projectsImg/HR-office.webp';
import logicDiagram from '/images/projectsImg/Logic-Diagram.webp';
import RoutetIT from '/images/projectsImg/Router-IT.webp';
import PCcommand from '/images/projectsImg/PC-command.webp';
import CableManagement from '/images/projectsImg/Cable-management.webp';
import IToffice from '/images/projectsImg/IT-office.webp';
import DHCP from '/images/projectsImg/DHCP.webp';

import Challenges from '/images/projectsImg/Challenges.webp';
import Scoreboard from '/images/projectsImg/Scoreboard.webp';
import Overview from '/images/projectsImg/Tenable-Overview.webp';
import Reports from '/images/projectsImg/Tenable-Reports.webp';

import InspectorHome from '/images/projectsImg/homePage.webp';
import githubIssues from '/images/projectsImg/githubIssues.webp';
import inspectorList from '/images/projectsImg/inspectorList.webp';
import inspectorModal from '/images/projectsImg/inspectorModal.webp';
import inspectorTool from '/images/projectsImg/inspectorTool.webp';
import adminLogin from '/images/projectsImg/adminLogin.webp';

import commandExecution from '/images/projectsImg/Command-Execution-Timeline.webp';
import dashboard1 from '/images/projectsImg/dashboard-1-overview.webp';
import dashboard2 from '/images/projectsImg/dashboard-2-threat-intel.webp';
import dashboard3 from '/images/projectsImg/dashboard-3-behavioral.webp';
import hoenypotTerminal from '/images/projectsImg/honeypot-terminal.webp';
import utmSetup from '/images/projectsImg/UTM-setup.webp';

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
  className,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,700px),minmax(0,1fr)] gap-8 lg:gap-16 items-start mt-6 lg:mt-40 ${className || ''}`}
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
      <section className="relative" id="CTF">
        <div
          className="relative"
          style={{ marginTop: 'calc(env(safe-area-inset-top) * -1)' }}
        >
          {/* Navbar over the cover with transparent background */}
          <div
            className="absolute inset-x-0 top-0 z-20"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            <Navbar transparent={true} />
          </div>
          <img
            alt="Lecture hall cover"
            className="w-full h-[380px] sm:h-[520px] md:h-[680px] lg:h-[820px] xl:h-[700px] object-cover"
            src="/images/Covers/cowrie-honeypot.webp"
          />
        </div>

        <div
          className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 mt-0 lg:-mt-32 pb-16 md:pb-24"
          style={{ marginTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}
        >
          <div className="lg:-mt-24">
            <TwoCol
              left={
                <SectionHeading>
                  <span className="leading-tight">
                    Cowrie Honeypot <br /> Splunk SIEM Analysis
                  </span>
                </SectionHeading>
              }
              right={
                <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
                  <p>
                    This project focused on deploying and analyzing an SSH
                    honeypot to better understand real-world attacker behavior
                    from a defender’s perspective. As a cybersecurity student, I
                    wanted hands-on experience beyond theory, so I used Cowrie
                    to simulate an exposed SSH service and capture brute-force
                    login attempts, credential targeting patterns, and
                    post-compromise command activity. The logs were then
                    forwarded into Splunk Enterprise, where I performed
                    centralized analysis and built detection workflows similar
                    to what a Security Operations Center (SOC) would use.
                  </p>
                  <p>
                    The platform demonstrates how raw security telemetry can be
                    transformed into actionable threat intelligence. I developed
                    custom Splunk searches and dashboards to analyze login
                    success and failure rates, attacker command execution
                    sequences, and session timelines. Observed behaviors were
                    mapped to the MITRE ATT&CK framework to better understand
                    the tactics and techniques attackers rely on, such as
                    account discovery and system reconnaissance.
                  </p>
                  <p>
                    More than just collecting logs, this project helped me
                    practice behavioral analysis and detection engineering. By
                    examining command patterns and attack chains from initial
                    access through post-exploitation, I gained practical insight
                    into how defenders can identify suspicious activity beyond
                    simple authentication events. While built in a lab
                    environment, the project reflects real-world SIEM monitoring
                    practices and strengthened my understanding of how threat
                    detection works in production environments.
                  </p>
                </div>
              }
            />

            <TwoCol
              left={
                <SectionHeading>
                  <span className="leading-tight font-normal">
                    System Build & Demo
                  </span>
                </SectionHeading>
              }
              right={
                <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 font-light">
                  <p>
                    The honeypot was deployed on Ubuntu (ARM64) within a
                    virtualized environment and configured to capture SSH
                    session metadata and command inputs in JSON format. Logs
                    were securely forwarded to Splunk using the Universal
                    Forwarder, where SPL queries were written to simulate
                    SOC-style investigations and threat hunting workflows.
                  </p>
                  <p>
                    Three primary dashboards were created to visualize attack
                    volume, behavioral trends, and MITRE ATT&CK technique
                    mapping. The completed system demonstrates practical
                    experience in SIEM configuration, log analysis, and security
                    monitoring design.
                  </p>

                  <br></br>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      Focus Areas: Threat intelligence, SIEM configuration,
                      detection engineering, behavioral analysis, MITRE ATT&CK
                      mapping
                    </li>
                    <li>
                      Technologies: Cowrie, Splunk Enterprise, Splunk Universal
                      Forwarder, Ubuntu (ARM64), Linux, SPL
                    </li>
                  </ul>

                  <br></br>

                  <p>
                    Source Code:{' '}
                    <a
                      href="https://github.com/jbimard/cowrie-honeypot-splunk-analysis"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      GitHub – Cowrie Honeypot + Splunk SIEM Analysis Repository
                    </a>
                  </p>
                </div>
              }
            />
          </div>
          <div className="mt-12 lg:mt-16 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <img
              src={dashboard1}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={dashboard2}
              alt="TA screenshot 2"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[400px] object-cover lg:object-contain"
            />
            <img
              src={dashboard3}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={commandExecution}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={hoenypotTerminal}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={utmSetup}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
          </div>
        </div>
      </section>

      <section className="relative" id="CTF">
        <img
          src={inspectorCover}
          alt="Enterprise network simulation cover"
          className="w-full h-[380px] sm:h-[520px] md:h-[680px] lg:h-[820px] xl:h-[700px] object-cover"
        />

        <div
          className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 mt-0 lg:-mt-32 pb-16 md:pb-24"
          style={{ marginTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}
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
                    Build & Test{' '}
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
                    created to present the platform’s features and workflow,
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
                    Video Demo:{' '}
                    <a
                      href="https://www.youtube.com/watch?v=o9GgqUrwWhY"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      YouTube – NC OSFM Licensed Inspector Lookup Platform
                    </a>
                    <br />
                    Source Code:{' '}
                    <a
                      href="https://github.com/ITSC-4155-G1/Locate-Code-Inspector/tree/dev"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      GitHub – Locate Code Inspector Repository
                    </a>
                  </p>
                </div>
              }
            />
          </div>
          <div className="mt-12 lg:mt-16 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <img
              src={InspectorHome}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={githubIssues}
              alt="TA screenshot 2"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[400px] object-cover lg:object-contain"
            />
            <img
              src={inspectorTool}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={inspectorList}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={inspectorModal}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={adminLogin}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
          </div>
        </div>
      </section>

      <section className="relative" id="Tenable">
        <img
          src={tenableCover}
          alt="Enterprise network simulation cover"
          className="w-full h-[380px] sm:h-[520px] md:h-[680px] lg:h-[820px] xl:h-[700px] object-cover"
        />

        <div
          className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 mt-0 lg:-mt-32 pb-16 md:pb-24"
          style={{ marginTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}
        >
          <div className="lg:-mt-24">
            <TwoCol
              left={
                <SectionHeading>
                  <span className="leading-tight">
                    Tenable <br /> Cloud Security Capture the Flag
                  </span>
                </SectionHeading>
              }
              right={
                <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
                  <p>
                    This hands-on session, held during the UNC Charlotte
                    Cybersecurity Symposium on September 30, 2025, focused on
                    securing AI workloads in cloud environments, covering risks
                    highlighted in Tenable’s 2025 Cloud AI Risk Report,
                    including default-permission deployments, public access
                    exposures, and weak governance around services like AWS
                    SageMaker, Amazon Bedrock, and Google Vertex AI. The talk
                    introduced Tenable AI Exposure, a framework for discovering
                    shadow AI, prioritizing AI-specific risks (prompt injection,
                    model abuse), and enforcing data protection policies.{' '}
                  </p>
                  <p>
                    Following the briefing, I competed in the Tenable Cloud
                    Security Capture the Flag, applying the concepts in a lab
                    setting. Challenges included hunting misconfigurations,
                    identifying over-privileged identities, and hardening
                    insecure AI and cloud pipelines under time pressure.
                  </p>
                </div>
              }
            />

            <TwoCol
              left={
                <SectionHeading>
                  <span className="leading-tight font-normal">
                    Results & Skills
                  </span>
                </SectionHeading>
              }
              right={
                <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 font-light">
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Placed 8th out of 100 participants.</li>
                    <li>
                      Resolved cloud misconfigurations across S3, IAM,
                      Kubernetes, and SSH.
                    </li>
                    <li>
                      Strengthened SOC skills in detection, triage, CSPM, and
                      IAM/CIEM.
                    </li>
                  </ul>
                </div>
              }
            />
          </div>
          <div className="mt-12 lg:mt-16 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <img
              src={Challenges}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={Scoreboard}
              alt="TA screenshot 2"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[400px] object-cover lg:object-contain"
            />
            <img
              src={Overview}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={Reports}
              alt="TA screenshot 1"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
          </div>
        </div>
      </section>

      <section className="relative pt-24" id="Cisco">
        <img
          src={ciscoCover}
          alt="Enterprise network simulation cover"
          className="w-full h-[380px] sm:h-[520px] md:h-[680px] lg:h-[820px] xl:h-[700px] object-cover"
        />
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 mt-6 lg:-mt-32 pb-16 md:pb-24">
          <TwoCol
            left={
              <SectionHeading>
                Enterprise Office Network Simulation
              </SectionHeading>
            }
            right={
              <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
                <p>
                  This project focused on designing and implementing a complete
                  network infrastructure for a medium-sized organization with
                  two office locations, the IT department and the HR department.
                  The network was structured to provide both wired and wireless
                  connectivity, ensuring reliable communication between devices
                  and departments while maintaining security through VLAN
                  segmentation. Core components such as routers, switches,
                  wireless LAN controllers, and access points were configured to
                  support day-to-day operations, while essential services like
                  DHCP, DNS, and file sharing were implemented to centralize and
                  streamline resource management.
                </p>
                <p>
                  In addition to connectivity, the project emphasized
                  scalability and security. Logical and physical diagrams were
                  created to document the design, making future troubleshooting
                  and expansion easier. Access control lists (ACLs), wireless
                  encryption, and firewall rules were incorporated to safeguard
                  the network against unauthorized access. Overall, the design
                  demonstrates a strong balance of functionality, efficiency,
                  and security within a professional IT setting.
                </p>
                <p>
                  If you want access to the Packet Tracer file, you can find it
                  on my{' '}
                  <a
                    href="https://github.com/jbimard/Network-Infrastructure-Project"
                    target="_blank"
                    className="underline"
                  >
                    GitHub
                  </a>
                  .
                </p>
                <p>
                  If you are looking for the documentation that was specifically
                  prepared and targeted for the company, you can find it in the
                  attached file:
                  <a
                    href="/files/Network Infrastructure Project Documentation.pdf"
                    target="_blank"
                    className="underline"
                  >
                    &nbsp;Network Infrastructure Project Documentation.pdf
                  </a>
                  .
                </p>
              </div>
            }
          />
          <TwoCol
            left={
              <SectionHeading>
                <span className="leading-tight font-normal">Simulation</span>
              </SectionHeading>
            }
            right={
              <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
                <p>
                  To bring this design to life, the network was fully simulated
                  in Cisco Packet Tracer, providing a hands-on environment to
                  test configurations, troubleshoot connections, and validate
                  system performance. This simulation included setting up IP
                  addressing schemes, configuring VLANs for segmentation, and
                  ensuring that both wired and wireless devices could
                  communicate effectively across the IT and HR offices. By
                  running the infrastructure virtually, I was able to replicate
                  real-world IT challenges, such as managing device roles,
                  configuring routing, and optimizing performance through DHCP,
                  DNS, and access control rules.
                </p>
                <p>
                  Working with Packet Tracer offered valuable IT experience by
                  simulating the responsibilities of a network administrator. It
                  required applying critical thinking and problem-solving skills
                  to address issues like misconfigured ports, faulty device
                  connections, and improper addressing. This hands-on practice
                  is essential for building the skills needed in real-world IT
                  environments, preparing me for situations where designing,
                  deploying, and securing enterprise-level networks are crucial.
                </p>
              </div>
            }
          />
          <div className="mt-12 lg:mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-0 items-start">
            <img
              src={HRoffcie}
              alt="HR office network equipment"
              className="w-full h-full sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-full object-cover lg:object-contain"
            />
            <img
              src={CityDiagram}
              alt="City layout diagram"
              className="w-full h-full sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-full object-cover lg:object-contain"
            />
            <img
              src={logicDiagram}
              alt="Logic diagram"
              className="w-full h-full sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-full object-cover lg:object-contain"
            />
            <img
              src={RoutetIT}
              alt="Router configuration"
              className="w-full h-full sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-full object-cover lg:object-contain"
            />
            <img
              src={PCcommand}
              alt="PC command window"
              className="w-full h-full sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-full object-cover lg:object-contain"
            />
            <img
              src={CableManagement}
              alt="Cable management view"
              className="w-full h-full sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-full object-cover lg:object-contain"
            />
            <img
              src={IToffice}
              alt="IT office overview"
              className="w-full h-full sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-full object-cover lg:object-contain"
            />
            <img
              src={DHCP}
              alt="DHCP configuration"
              className="w-full h-full sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-full object-cover lg:object-contain"
            />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Work;
