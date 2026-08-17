import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import ctpLogo from "/images/Covers/ConoceTuProfesor-logo.webp";
import illustrationBook from "/images/ctpImg/illustration-book.webp";

import securityShield from "/images/ctpImg/security-shield.webp";
import localPizza from "/images/ctpImg/local-pizza.webp";
import exerciseGym from "/images/ctpImg/exercise-gym.webp";
import socialFriends from "/images/ctpImg/social-friends.webp";
import airportShuttle from "/images/ctpImg/airport-shuttle.webp";
import locationCity from "/images/ctpImg/location-city.webp";

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

const amenities = [
  { icon: securityShield, label: "Seguridad" },
  { icon: localPizza, label: "Comida" },
  { icon: exerciseGym, label: "Deporte" },
  { icon: socialFriends, label: "Vida social" },
  { icon: airportShuttle, label: "Transporte" },
  { icon: locationCity, label: "Ubicación" },
];

const ConoceTuProfesor: React.FC = () => {
  return (
    <main className="w-screen overflow-x-hidden bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative bg-neutral-100">
        <div className="w-full min-h-[380px] sm:min-h-[460px] md:min-h-[560px] flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-14 px-6 py-16">
          <img
            src={illustrationBook}
            alt="Conoce Tu Profesor illustration"
            className="h-40 sm:h-56 md:h-72 w-auto object-contain"
          />
          <div className="flex flex-col items-center sm:items-start gap-4 text-center sm:text-left">
            <img
              src={ctpLogo}
              alt="Conoce Tu Profesor logo"
              className="h-16 sm:h-20 md:h-24 w-auto object-contain"
            />
            <h1 className="font-extrabold tracking-tight leading-none text-black text-4xl sm:text-5xl md:text-6xl">
              Conoce Tu Profesor
            </h1>
            <p className="text-black/60 text-base sm:text-lg md:text-xl max-w-md">
              Opiniones de profesores en Latinoamérica.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 pb-16 md:pb-24">
        <TwoCol
          left={<SectionHeading>What is it</SectionHeading>}
          right={
            <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
              <p>
                Conoce Tu Profesor is a bilingual platform where university
                students across Latin America and the Caribbean can search for
                their professors, read honest reviews left by other students,
                and share their own experience. In many universities you
                don't get to choose your professor, but you can arrive
                prepared. Every review is fully anonymous, so students can
                share their real experience without hesitation.
              </p>
              <p>
                The platform is live at{" "}
                <a
                  href="https://www.conocetuprofesor.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  conocetuprofesor.com
                </a>
                , seeded with 237+ universities across 17 countries spanning
                Central America, the Caribbean, Mexico, South America, and
                Brazil. The site automatically switches between Spanish and
                Brazilian Portuguese based on the student's selected country.
              </p>
              <p>
                Beyond professor reviews, students can also rate their
                university itself across everyday quality-of-life categories:
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 pt-2">
                {amenities.map((a) => (
                  <div key={a.label} className="flex flex-col items-center gap-2 text-center">
                    <img src={a.icon} alt="" className="h-10 w-10 object-contain" />
                    <span className="text-xs sm:text-sm text-black/70">{a.label}</span>
                  </div>
                ))}
              </div>
            </div>
          }
        />

        <TwoCol
          left={
            <SectionHeading>
              <span className="leading-tight font-normal">Build & Stack</span>
            </SectionHeading>
          }
          right={
            <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 font-light">
              <p>
                I designed and built the entire product solo, from the
                frontend to the database: a React 19 + Vite frontend, a
                Node.js/Express 5 REST API, and a Supabase (PostgreSQL)
                database, deployed on Vercel and Railway. Every review passes
                through two layers of moderation: a static and admin managed
                blacklist filter, plus OpenAI's moderation API, before it's
                allowed to publish. Sessions are handled with httpOnly,
                strict SameSite JWT cookies rather than storage that client
                side code can access.
              </p>
              <p>
                The product also includes an admin panel for managing
                professors, universities, subjects, and flagged reviews, and
                a finance panel that tracks monthly and yearly infrastructure
                costs with trend charts and automated payment-reminder
                emails.
              </p>

              <br></br>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Focus Areas: Full-stack product design & development,
                  content moderation, authentication & session security,
                  internationalization (i18n), admin tooling
                </li>
                <li>
                  Technologies: React 19, Vite, React Router 7, react-i18next,
                  Node.js, Express 5, Supabase (PostgreSQL), JWT, OpenAI
                  Moderation API, Resend, Vercel, Railway
                </li>
              </ul>

              <br></br>

              <p>
                Live Site:{" "}
                <a
                  href="https://www.conocetuprofesor.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  conocetuprofesor.com
                </a>
              </p>
            </div>
          }
        />
      </div>

      <Footer />
    </main>
  );
};

export default ConoceTuProfesor;
