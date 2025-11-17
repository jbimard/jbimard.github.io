import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import NotionIframe from "../components/NotionIframe.tsx";



const Goals = () => {
  return (
    <main className="min-h-screen bg-white text-black">
      <Navbar />
      <section className="mx-auto max-w-[1280px] px-6 md:px-10 py-10 md:py-20 space-y-16 sm:space-y-24 md:space-y-40 lg:px-0">
        {/* Certifications */}
        <div className="space-y-4">
          <h2 className="font-bold tracking-tight text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight">
            Certifications I’m Working Toward
          </h2>
          <p className="max-w-[2000px] max-h-[2000px] text-sm md:text-base leading-6 md:leading-7 opacity-80">
            I’m currently focused on building a strong foundation in cybersecurity through industry‑recognized certifications. These help
            reinforce both practical skills and theoretical knowledge as I grow into the field.
          </p>
          {/* Live Notion table */}
          <NotionIframe
            pageId="248726348d9c8031aa97fcfd4ed2a67b"
            title="Notion Embed - Certifications"
            height={600}
          />
        </div>

        {/* Academic Milestones */}
        <div className="space-y-6">
          <h2 className="font-bold tracking-tight text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight">
            Academic Milestones
          </h2>
          <p className="max-w-[1280px] text-sm md:text-base leading-6 md:leading-7 opacity-80">
            One of my key goals is to complete my undergraduate degree while continuing my graduate‑level coursework through UNC Charlotte’s
            Early Entry Cybersecurity M.S. program. This dual‑track path allows me to deepen my expertise while staying focused on the
            future of secure systems.
          </p>
          <ul className="max-w-[1280px] text-sm md:text-base leading-6 md:leading-7 space-y-3">
            <li>🎓 Complete B.S. in Computer Science, Cybersecurity Concentration (Spring 2026)</li>
            <li>🎯 Finish Early Entry M.S. in Cybersecurity (Spring 2027)</li>
            <li>💼 Pursue an MBA at UNC Chapel Hill later in my career to grow as a leader and decision‑maker in the tech industry. (Future)</li>
          </ul>
        </div>

        {/* What I'm Building */}
        <div className="space-y-4">
          <h2 className="font-bold tracking-tight text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight">
            What I’m Building
          </h2>
          <p className="max-w-[1280px] text-sm md:text-base leading-6 md:leading-7 opacity-80">
            I believe the best way to grow is by building. This section highlights projects I’m currently working on, experimenting with, or
            planning next—ranging from security labs and dashboards to network simulations. You can view live updates and progress through
            my Notion board below.
          </p>
          {/* Live Notion table*/}
          <NotionIframe
  pageId="23a726348d9c80a8bc39f310d6432e49"
  title="Notion Embed - Projects"
  height={600}
/>
          
        </div>
      </section>
      <Footer />
    </main>
  );
};
export default Goals;