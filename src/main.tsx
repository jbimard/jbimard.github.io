import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App'
import About from './pages/About'
import Projects from './pages/Projects'
import Skills from './pages/Skills'
import CertsInterface from './pages/CertsInterface'
import Certs from './pages/Certs'
import Goals from './pages/Goals'
import WorkInterface from './pages/WorkInterface'
import Work from './pages/Work'
import ProjectsInterface from './pages/ProjectsInterface'
import UNCCharlotte from './pages/UNCCharlotte'
import NCOSFM from './pages/NCOSFM'
import CowrieHoneypot from './pages/CowrieHoneypot'
import ConoceTuProfesor from './pages/ConoceTuProfesor'
import TrueHomes from './pages/TrueHomes'
import ComingSoon from './pages/ComingSoon'
import Jobs from './pages/jobs/Jobs'

const router = createBrowserRouter([
  // Home page
  { path: '/', element: <App/> },
  { path: '/about', element: <About/> },
  { path: '/workinterface', element: <WorkInterface/> },
  { path: '/work', element: <Work/> },
  { path: '/projectsinterface', element: <ProjectsInterface/> },
  { path: '/projects', element: <Projects/> },
  { path: '/skills', element: <Skills/> },
  { path: '/certsinterface', element: <CertsInterface/> },
  { path: '/certs', element: <Certs/> },
  { path: '/goals', element: <Goals/> },
  { path: '/unccharlotte', element: <UNCCharlotte/> },
  { path: '/ncosfm', element: <NCOSFM/> },
  { path: '/cowriehoneypot', element: <CowrieHoneypot/> },
  { path: '/conocetuprofesor', element: <ConoceTuProfesor/> },
  { path: '/truehomes', element: <TrueHomes/> },
  { path: '/comingsoon', element: <ComingSoon/> },
  { path: '/jobs', element: <Jobs/> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
