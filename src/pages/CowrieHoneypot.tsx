import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import commandExecution from "/images/projectsImg/Command-Execution-Timeline.webp";
import dashboard1 from "/images/projectsImg/dashboard-1-overview.webp";
import dashboard2 from "/images/projectsImg/dashboard-2-threat-intel.webp";
import dashboard3 from "/images/projectsImg/dashboard-3-behavioral.webp";
import hoenypotTerminal from "/images/projectsImg/honeypot-terminal.webp";
import utmSetup from "/images/projectsImg/UTM-setup.webp";

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

const CowrieHoneypot = () => {
  return (
    <main className="w-screen overflow-x-hidden bg-white">
      <section className="relative" id="cowrie-honeypot">
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
            alt="Cowrie honeypot cover"
            className="w-full h-[380px] sm:h-[520px] md:h-[680px] lg:h-[820px] xl:h-[700px] object-cover"
            src="/images/Covers/cowrie-honeypot.webp"
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
                    Cowrie Honeypot <br /> Splunk SIEM Analysis
                  </span>
                </SectionHeading>
              }
              right={
                <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
                  <p>
                    This project focused on deploying and analyzing an SSH
                    honeypot to better understand real-world attacker behavior
                    from a defender's perspective. As a cybersecurity student, I
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
                    Source Code:{" "}
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
              alt="Splunk dashboard overview"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={dashboard2}
              alt="Splunk threat intel dashboard"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[400px] object-cover lg:object-contain"
            />
            <img
              src={dashboard3}
              alt="Splunk behavioral dashboard"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={commandExecution}
              alt="Command execution timeline"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={hoenypotTerminal}
              alt="Honeypot terminal session"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
            <img
              src={utmSetup}
              alt="UTM setup"
              className="w-full h-[full] sm:h-[320px] md:h-[420px] lg:w-[700px] lg:h-[500px] object-cover lg:object-contain"
            />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default CowrieHoneypot;
