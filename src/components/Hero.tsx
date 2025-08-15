import { useState } from 'react'

const cards=[
  {
    src:'/images/About.png',
    alt:'About',
    title:'About',
    href:'/about',
    desc:
      `Hi, I’m Joseph, a cybersecurity student with a passion for clean code, secure systems, and creative solutions. With a background in web development, teaching, and QA testing, I’m currently transitioning into cybersecurity through hands-on research and certifications like Security+ and ISC2 CC.
I’m focused on building secure applications and plan to pursue my master’s in cybersecurity through UNC Charlotte’s Early Entry Program.`
  },
  { src:'/images/Work.png', alt:'Work', title:'Work', href:'/workinterface', desc:'Take a look at the diverse experiences that have sharpened my skills across multiple fields. From mentoring students and assisting in classrooms to developing practical solutions in tech environments, each opportunity has helped me grow both technically and professionally. These experiences continue to guide and strengthen my path toward a career in cybersecurity.' },
  { src:'/images/Projects.png', alt:'Projects', title:'Projects', href:'/projectsinterface', desc:'Here’s a closer look at the projects that have shaped my learning and growth. Whether it’s securing a simulated network, building web applications, or exploring new tools in my home lab, each project reflects my commitment to applying knowledge in real-world scenarios and expanding my cybersecurity capabilities.' },
  { src:'/images/Skills.png', alt:'Skills', title:'Skills', href:'/skills', desc:'This is where my technical foundation comes to life. From programming and design to cybersecurity fundamentals, my skill set reflects both creative thinking and analytical problem-solving. I’m constantly building on these abilities through hands-on projects, coursework, and self-guided learning.' },
  { src:'/images/Certs.png', alt:'Certs', title:'Certs', href:'/certsinterface', desc:'My certifications represent the milestones in my journey toward becoming a cybersecurity professional. Each one reflects the knowledge I’ve gained, the standards I’ve met, and my commitment to staying current in an ever-evolving field. I’m actively working toward more to continue strengthening my expertise.' },
  { src:'/images/Goals.png', alt:'Goals', title:'Goals', href:'/goals', desc:'This section is like my little journal, a space where I track my goals, stay focused, and remind myself of the bigger picture. It helps me reflect on where I’ve been, where I’m going, and how each step brings me closer to the future I want to build. From certifications to projects I’m excited to tackle, this is where I stay grounded and motivated. If you’re curious, feel free to explore what I’ve set my sights on next.' }
]

const Card = ({ src, alt, title, desc, href }: { src: string; alt: string; title: string; desc: string; href: string }) => {
  const [show, setShow] = useState(false)

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.innerWidth < 768 && !show) {
      e.preventDefault()
      setShow(true)
    }
  }

  return (
    <figure className="relative w-full border border-black/0 bg-white">
      <a
        href={href}
        className="group block relative focus:outline-none focus-visible:ring-2 focus-visible:ring-black/50"
        onClick={handleClick}
        onBlur={() => setShow(false)}
      >
        <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" />

        {/* Overlay on hover/focus for desktop, toggled for mobile */}
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center p-6 bg-black/70 transition-opacity duration-300 ${
            show ? 'opacity-100 pointer-events-auto' : 'opacity-0'
          } group-hover:opacity-100 group-focus-visible:opacity-100`}
        >
          <div className="text-center text-white max-w-md h-64 flex flex-col justify-center">
            <h3 className="font-semibold text-xl md:text-2xl tracking-tight">{title}</h3>
            <p className="mt-3 text-lg leading-loose opacity-90">{desc}</p>
          </div>
        </div>
      </a>
    </figure>
  )
}

const Hero=()=>{
  return (
    <section id="top" className="mx-auto max-w-7xl px-0 pt-12 md:pt-24">
      <h1 className="text-left font-medium leading-tight text-4xl md:text-8xl tracking-tight md:pb-10 ml-4 md:ml-0">
        Designing from a desk, dreaming beyond walls.
      </h1>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(card => (
          <Card key={card.alt} {...card} />
        ))}
      </div>
    </section>
  )
}

export default Hero