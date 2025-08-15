import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

type RowProps = { title: string; children: React.ReactNode };

const Row = ({ title, children }: RowProps) => {
  return (
    <div className="grid gap-6 sm:grid-cols-12 sm:gap-8 items-start">
      <h2 className="sm:col-span-3 font-bold text-3xl sm:text-6xl">
        {title}
      </h2>
      <div className="sm:col-span-9 font-light text-sm sm:text-base lg:ml-50">
        {children}
      </div>
    </div>
  );
};

const About=()=>{
  return (
    <>
      <Navbar />
      <main className="bg-white text-black">
        <section className="mx-auto max-w-7xl px-4 sm:px-0 py-10">
          {/* Page title spacing */}
          <div className="mb-6 md:mb-10">
          </div>

          <div className="grid gap-10 md:gap-14">
            <Row title="Cybersecurity">
              <ul className="list-none pl-0 space-y-2">
              <li>Vulnerability Analysis</li>
              <li>Network Protocols (TCP/IP, OSI Model)</li>
              <li>Packet Analysis (Wireshark)</li>
              <li>Threat Modeling & Risk Assessment</li>
              <li>Secure Coding Practices</li>
              <li>Cybersecurity Research (LLM-based exploit automation, formal exploit modeling)</li>
              <li>Cisco Packet Tracer</li>
              <li>Web Security Principles</li>
              <li>QA Testing & Debugging</li>
              </ul>
            </Row>

            <Row title="Programming ">
              <ul className="space-y-1">
                <li>Python</li>
                <li>Java</li>
                <li>JavaScript</li>
                <li>HTML & CSS</li>
                <li>Swift(basics)</li>
              </ul>
            </Row>

            <Row title="Tools & Platforms">
              <ul className="space-y-1">
                <li>Git & Github</li>
                <li>Wireshark</li>
                <li>Cisco Packet Tracer</li>
                <li>Figma</li>
                <li>Xcode</li>
                <li>Microsoft Office Suite</li>
                <li>Photoshop</li>
              </ul>
            </Row>

            <Row title="Soft Skills">
              <ul className="space-y-1">
                <li>Technical Mentoring & Teaching</li>
                <li>Communication & Team Collaboration</li>
                <li>Research & Literature Review</li>
                <li>Public Speaking & Student Support</li>
              </ul>
            </Row>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
export default About