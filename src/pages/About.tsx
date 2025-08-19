import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

type RowProps = { title: string; children: React.ReactNode };

const Row = ({ title, children }: RowProps) => {
  return (
    <div className="grid gap-6 sm:grid-cols-12 sm:gap-8 items-start">
      <h2 className="sm:col-span-3 font-bold text-3xl sm:text-6xl">
        {title}
      </h2>
      <div className="sm:col-span-9 font-light text-sm sm:text-base">
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
            <h1 className="sr-only">About Joseph Posas</h1>
          </div>

          <div className="grid gap-10 md:gap-14">
            <Row title="About">
              <p>
                I’m calling Charlotte, North Carolina home these days, but I’m originally from Honduras, a country
                full of vibrant culture, warm people, and the roots of my love for learning and
                community. When I’m not working on tech projects, I’m usually out playing soccer or
                volleyball, reading a good book, or spending time with my friends and my brother. If
                you ever want to chat or connect, feel free to reach out at{' '}
                <a href="mailto:joseph.posasm@gmail.com" className="underline hover:opacity-80">
                  joseph.posasm@gmail.com
                </a>.
              </p>
            </Row>

            <Row title="Work">
              <ul className="space-y-1">
                <li>Dec 2024 – Now // TA / University of North Carolina at Charlotte</li>
                <li>Sep 2023 – Dec 2024 // Research / University of North Carolina at Charlotte</li>
                <li>Mar 2024 – Aug 2024 // Linxy</li>
                <li>Dec 2023 – Jul 2024 // Honeywell / Central Piedmont Community College</li>
              </ul>
            </Row>

            <Row title="Tools">
              <ul className="space-y-1">
                <li>Wireshark, Packet Tracer, GitHub, Xcode</li>
                <li>Java, Python, HTML, CSS, Swift, JavaScript</li>
                <li>Figma, Photoshop</li>
                <li>Microsoft Office Suite</li>
              </ul>
            </Row>

            <Row title="Certs.">
              <ul className="space-y-1">
                <li>2024 // Forage – Mastercard Cybersecurity Job Simulation</li>
                <li>2022 // Coursera – Python Data Structures</li>
              </ul>
            </Row>

            <Row title="Awards">
              <ul className="space-y-1">
                <li>2025 // Latin Americans Working for Achievements Scholar</li>
                <li>2024 // First Place Winner, STEM Tank Engineering Competition</li>
                <li>2024 // NC Space Grant Recipient</li>
                <li>2023 // Truist Honors Scholar</li>
                <li>2023 // Phi Theta Kappa</li>
              </ul>
            </Row>

            <Row title="Education">
              <ul className="space-y-1">
                <li>2027 // UNC Charlotte – Early Entry Master of Science in Cybersecurity</li>
                <li>2026 // UNC Charlotte – B.S. in Computer Science, Cybersecurity Concentration</li>
                <li>2024 // Central Piedmont Community College – Associate’s in Computer Science</li>
              </ul>
            </Row>

            <Row title="Resume">
              <p className="mb-3">
                If you’re interested in learning more about my background, experience, and skills in
                greater detail, feel free to check out my resume. It provides a full overview of the
                work I’ve done, the tools I’ve used, and the goals I’m working toward.
              </p>
              <a
              {/* This section displays my resume link */}
                href="../public/files/JosephPosasResume.pdf"
                className="inline-flex items-center underline underline-offset-2 hover:opacity-80"
              >Download<span aria-hidden>⤓</span>
              </a>
            </Row>

            <Row title="Socials">
              <ul className="space-y-1">
                <li><a href="https://www.linkedin.com/in/joseph-posas/" target="_blank" rel="noreferrer" className="underline hover:opacity-80">LinkedIn</a></li>
                <li><a href="mailto:joseph.posasm@gmail.com" className="underline hover:opacity-80">Email</a></li>
                <li><a href="https://github.com/jbimard" target="_blank" rel="noreferrer" className="underline hover:opacity-80">Github</a></li>
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