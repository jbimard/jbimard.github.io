import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Footer from './components/Footer'

const App=()=>{
  const onJump=(id:string)=>{
    const el=document.getElementById(id)
    if(el){ el.scrollIntoView({behavior:'smooth',block:'start'}) }
  }

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <Navbar onJump={onJump}/>
      <Hero/>
      <Footer/>
    </main>
  )
}

export default App