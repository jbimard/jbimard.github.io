import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import trueHomesLogo from "/images/Covers/TrueHomes-logo.svg";
import roleAdminImg from "/images/trueHomesImg/role-admin.webp";
import analyticsPipelineImg from "/images/trueHomesImg/analytics-pipeline.webp";
import auditReportImg from "/images/trueHomesImg/audit-report-summary.webp";

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

const TrueHomes: React.FC = () => {
  return (
    <main className="w-screen overflow-x-hidden bg-white">
      <Navbar />

      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 pt-10 sm:pt-16 md:pt-24 pb-16 md:pb-24">
        <div className="max-w-3xl">
          <img
            src={trueHomesLogo}
            alt="True Homes logo"
            className="h-8 sm:h-10 md:h-12 w-auto object-contain"
          />
          <p className="mt-6 text-black/60 text-lg md:text-xl">
            Cybersecurity Rotational Intern &middot; Enterprise Technology
            Services &middot; Summer 2026 &middot; Charlotte, NC
          </p>
          <p className="mt-6 text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 font-light">
            A twelve-week rotational internship across application
            development, business intelligence, and infrastructure/security
            teams, with real work items against production systems, tracked
            on the team board, with the same process expectations as any
            other engineer.
          </p>
        </div>

        {/* Rotation I */}
        <TwoCol
          left={
            <SectionHeading>
              <span className="leading-tight">Application Development</span>
            </SectionHeading>
          }
          right={
            <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
              <p>
                In the first rotation of the internship, I served as sole
                developer on a self-service role administration feature for
                an internal estimating and purchasing application. The app
                had no way to manage who could do what inside it, and every
                access change meant manual work in the cloud identity portal
                by one of a handful of people holding elevated directory
                permissions. I built an administration page where every user
                and their roles live in one grid, with changes made directly
                from the row.
              </p>
              <p>
                The design decision that mattered was refusing to write
                authorization logic into the application itself. The five
                application roles are defined and enforced by Microsoft Entra
                ID, each backed by a security group; when an administrator
                changes someone's roles, the app updates group membership
                through Microsoft Graph rather than writing to a local
                permissions table, so the identity platform stays the
                authoritative source of who has access. I also provisioned
                the supporting identity infrastructure for three environments
                as version-controlled Terraform, using federated credentials
                so the application stores no secrets.
              </p>
              <p>
                The full specified scope shipped roughly two weeks ahead of
                schedule, eliminating a manual access-provisioning bottleneck
                and giving the organization a single view of who holds which
                role.
              </p>

              <br></br>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Focus Areas: Identity & access management, authorization
                  architecture, infrastructure as code
                </li>
                <li>
                  Technologies: C# / .NET, Entity Framework Core, DevExtreme,
                  Microsoft Entra ID, Microsoft Graph, Terraform, Azure DevOps
                </li>
              </ul>
            </div>
          }
        />
        <div className="mt-12 lg:mt-16">
          <img
            src={roleAdminImg}
            alt="Role administration grid showing users and their assigned application roles"
            className="w-full h-auto object-contain border border-black/10"
          />
        </div>

        {/* Rotation II */}
        <TwoCol
          left={
            <SectionHeading>
              <span className="leading-tight">
                Business Intelligence & Data
              </span>
            </SectionHeading>
          }
          right={
            <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
              <p>
                In the second rotation I moved to the business intelligence
                team to re-architect how business data reached the enterprise
                analytics platform. Forty business entities needed to move
                from a transactional database into the warehouse, and the
                team's existing approach, hand-building a copy operation per
                table, did not scale: every schema change or new entity
                meant more hand-mapped code, with no way to prove that data
                moving through several hops had arrived intact.
              </p>
              <p>
                I built the pipeline to be metadata-driven instead. A control
                table lists each entity and whether it's enabled, and a
                generator notebook reads that table to emit the schema and
                load procedures, so onboarding a new entity is a single row
                rather than new code. I added row-count validation at every
                stage of the four-hop path and rewrote the load from a
                sequential design into a two-phase parallel one, cutting the
                full daily cycle from roughly 62 minutes to about 4, an
                approximately 15&times; improvement.
              </p>

              <br></br>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Focus Areas: Data engineering, pipeline architecture,
                  performance
                </li>
                <li>
                  Technologies: Microsoft Fabric (Lakehouse, Warehouse,
                  Pipelines), PySpark, T-SQL, Azure SQL, Power BI
                </li>
              </ul>
            </div>
          }
        />
        <div className="mt-12 lg:mt-16">
          <img
            src={analyticsPipelineImg}
            alt="Metadata-driven analytics pipeline: lookup, parallel copy and load, and endpoint refresh stages"
            className="w-full h-auto object-contain border border-black/10"
          />
        </div>

        {/* Rotation III */}
        <TwoCol
          left={
            <SectionHeading>
              <span className="leading-tight">Infrastructure & Security</span>
            </SectionHeading>
          }
          right={
            <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 space-y-6 font-light">
              <p>
                In the third rotation I worked on the infrastructure and
                security team, where I operated with the most independence:
                authoring the scope document, designing the architecture, and
                driving investigations where no one on the team had a ready
                answer. The central project was a read-only privileged access
                audit tool, built to answer a question the organization
                couldn't otherwise answer: who holds elevated access across
                our systems, how did they get it, and where is it excessive
                or unaccountable.
              </p>
              <p>
                I designed a modular collector for each of six identity and
                security platforms, all following the same
                connect-collect-evaluate-emit template, so that findings from
                platforms with completely different role models could be
                normalized into one comparable, nineteen-field record. Every
                finding is rated against a three-tier risk model grounded in
                published vendor guidance and NIST 800-53 access control
                families, rather than invented from scratch. The tool
                surfaced real findings during development, including
                privileged access inherited through nested groups that a
                direct-membership review would have missed entirely.
              </p>
            </div>
          }
        />
        <div className="mt-12 lg:mt-16">
          <img
            src={auditReportImg}
            alt="Privileged access audit report summary categories"
            className="w-full h-auto object-contain border border-black/10"
          />
        </div>

        <TwoCol
          left={
            <SectionHeading>
              <span className="leading-tight font-normal">
                Security Operations
              </span>
            </SectionHeading>
          }
          right={
            <div className="text-black max-w-[950px] text-base sm:text-lg md:text-xl leading-7 md:leading-9 font-light">
              <p>
                Alongside the audit, I picked up two additional security
                operations workstreams. On the endpoint detection platform, I
                diagnosed and fixed an alert that was re-firing every five
                minutes for devices analysts had already acknowledged,
                reframing a disconnected device as a state rather than an
                event and converting the noise into a single notification per
                genuine transition. I also led a complete investigation into
                an email spoofing campaign, tracing header forensics to
                separate external spoofing from account compromise, auditing
                the gateway's anti-spoofing configuration, and deploying a
                remediating mail transport rule in audit mode first, with a
                documented rollback path.
              </p>

              <br></br>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Focus Areas: Privileged access review, risk modeling,
                  security operations, alert tuning, email security
                </li>
                <li>
                  Technologies: PowerShell, Active Directory, Microsoft Entra
                  ID, Microsoft Graph, Exchange Online, Intune, SentinelOne,
                  Mimecast, Azure DevOps
                </li>
              </ul>
            </div>
          }
        />
      </div>

      <Footer />
    </main>
  );
};

export default TrueHomes;
