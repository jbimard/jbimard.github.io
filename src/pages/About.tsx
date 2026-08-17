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

             <Row title="Resume">
              <p className="mb-3">
                If you’re interested in learning more about my background, experience, and skills in
                greater detail, feel free to check out my resume. I keep two versions depending on the
                role: one weighted toward cloud/software engineering, one weighted toward security and IAM.
              </p>
              <ul className="space-y-1">
                <li>
                  <a
                    href="/files/JosephPosas-CloudEngineerResume.pdf"
                    className="inline-flex items-center underline underline-offset-2 hover:opacity-80"
                  >Cloud Engineer Resume<span aria-hidden className="ml-1">⤓</span>
                  </a>
                </li>
                <li>
                  <a
                    href="/files/JosephPosas-SecurityCloudResume.pdf"
                    className="inline-flex items-center underline underline-offset-2 hover:opacity-80"
                  >Security & Cloud Resume<span aria-hidden className="ml-1">⤓</span>
                  </a>
                </li>
              </ul>
            </Row>

            <Row title="Work">
              <ul className="space-y-1">
                <li>
                  Summer 2026 // Cybersecurity Rotational Intern /{' '}
                  <a href="/truehomes" className="underline hover:opacity-80">True Homes</a>
                </li>
                <li>
                  Dec 2024 – Now // TA /{' '}
                  <a href="/unccharlotte" className="underline hover:opacity-80">University of North Carolina at Charlotte</a>
                </li>
                <li>
                  Sep 2023 – Dec 2024 // Research /{' '}
                  <a href="/unccharlotte" className="underline hover:opacity-80">University of North Carolina at Charlotte</a>
                </li>
                <li>Mar 2024 – Aug 2024 // Linxy</li>
                <li>Dec 2023 – Jul 2024 // Honeywell / Central Piedmont Community College</li>
              </ul>
            </Row>

            <Row title="Tools">
              <ul className="space-y-1">
                <li>Microsoft Entra ID, Microsoft Graph, Active Directory, Azure DevOps</li>
                <li>C# / .NET, PowerShell, Terraform, T-SQL</li>
                <li>Wireshark, Packet Tracer, GitHub, Xcode</li>
                <li>Java, Python, HTML, CSS, Swift, JavaScript</li>
                <li>Figma, Photoshop</li>
                <li>Microsoft Office Suite</li>
              </ul>
            </Row>

            <Row title="Education">
              <ul className="space-y-1">
                <li>2027 // University of North Carolina at Charlotte – Early Entry Master of Science in Cybersecurity</li>
                <li>2026 // University of North Carolina at Charlotte – B.S. in Computer Science, Cybersecurity Concentration</li>
                <li>2024 // Central Piedmont Community College – Associate’s in Computer Science</li>
              </ul>
            </Row>

           

            <Row title="Socials">
              <ul className="space-y-1">
                <li><a href="https://www.linkedin.com/in/josephposas/" target="_blank" rel="noreferrer" className="underline hover:opacity-80">LinkedIn</a></li>
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