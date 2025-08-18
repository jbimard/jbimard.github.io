import { useState, useEffect, useRef } from 'react'

const cards = [
  { src: '/images/Work.png', alt: 'Work', title: 'Work', href: '/workinterface' },
  { src: '/images/Projects.png', alt: 'Projects', title: 'Projects', href: '/projectsinterface' },
  { src: '/images/Certs.png', alt: 'Certs', title: 'Certs', href: '/certsinterface' },
]

const Card = ({ src, alt, title, href }: { src: string; alt: string; title: string; href: string }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const cardRef = useRef<HTMLElement>(null)

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (!isMobile || !cardRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show overlay when card is 50% visible
        setIsVisible(entry.intersectionRatio > 0.5)
      },
      {
        threshold: [0, 0.5, 1],
        rootMargin: '-10% 0px -10% 0px' // Trigger when card is well within viewport
      }
    )

    observer.observe(cardRef.current)

    return () => observer.disconnect()
  }, [isMobile])

  return (
    <figure 
      ref={cardRef}
      className="relative w-full border border-black/0 bg-white group touch-overlay"
    >
      <a
        href={href}
        className="block relative focus:outline-none focus-visible:ring-2 focus-visible:ring-black/50"
      >
        <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" />
        {/* Overlay on hover/focus for desktop and on scroll visibility for mobile */}
        <div
          className={`overlay absolute inset-0 flex items-center justify-center p-6 bg-black/70 transition-opacity duration-300 ${
            isMobile 
              ? (isVisible ? 'opacity-100' : 'opacity-0')
              : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
          }`}
        >
          <div className="text-center text-white max-w-md h-64 flex flex-col justify-center">
            <h3 className="font-semibold text-xl md:text-2xl tracking-tight">{title}</h3>
          </div>
        </div>
      </a>
    </figure>
  )
}

const Hero = () => {
  return (
    <section id="top" className="mx-auto max-w-7xl px-0 pt-12 md:pt-24">
      <h1 className="text-left font-medium leading-tight text-4xl md:text-8xl tracking-tight md:pb-10 ml-4 md:ml-0">
        Designing from a desk,
        dreaming beyond walls.
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