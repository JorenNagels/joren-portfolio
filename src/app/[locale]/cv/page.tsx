import type { Metadata } from 'next';
import Link from 'next/link';
import { LangSwitch } from '@/components/LangSwitch';
import { PrintButton } from '@/components/PrintButton';
import { education, experience, headline, interests, languages, learning, person, skills, summary } from '@/content/profile';
import { projects } from '@/content/projects';
import type { Locale } from '@/content/types';
import { period, ui } from '@/content/ui';

export const metadata: Metadata = { title: 'CV' };

export default async function CvPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale: l } = await params;
  const cvProjects = projects.filter((p) => p.cv);

  return (
    <div className="min-h-dvh bg-[#16181d] pb-16 print:bg-white print:pb-0">
      <div className="no-print mx-auto flex h-16 max-w-[210mm] items-center justify-between gap-3 px-4 text-sm">
        <Link href={`/${l}/`} className="hover:underline">{ui.cv.back[l]}</Link>
        <div className="flex items-center gap-5">
          <LangSwitch locale={l} path="cv/" />
          <PrintButton label={ui.cv.print[l]} />
        </div>
      </div>

      <article className="cv-sheet mx-auto w-full max-w-[210mm] px-[6%] py-10 text-[13px] leading-[1.5] sm:px-[14mm] sm:py-[13mm]">
        {/* Header */}
        <header className="flex items-end gap-5 border-b-2 border-ink pb-5">
          <img src={person.photo} alt="" className="h-[84px] w-[84px] shrink-0 rounded-full object-cover" style={{ objectPosition: '50% 25%' }} />
          <div className="flex flex-1 flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <h1 className="text-[40px] font-semibold leading-none tracking-[-0.04em]">{person.name}</h1>
              <p className="mt-1.5 text-[15px] text-muted">{headline[l]}, {person.location[l]}</p>
            </div>
            <ul className="text-[12.5px] leading-[1.55] sm:text-right">
              <li><a href={`mailto:${person.email}`}>{person.email}</a></li>
              {/* Filled in by the PDF export; stays hidden (and empty) on the public site. */}
              <li data-private-row hidden><span data-private="phone" /></li>
              <li><a href={person.github}>github.com/JorenNagels</a></li>
              <li><a href={person.site}>{person.site.replace('https://', '')}</a></li>
            </ul>
          </div>
        </header>

        <p className="mt-5 leading-relaxed">{summary[l]}</p>

        <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-[1fr_29%]">
          <div>
            <CvHeading>{ui.cv.experience[l]}</CvHeading>
            <div className="space-y-5">
              {experience.map((role) => (
                <section key={role.company}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 break-after-avoid">
                    <h3 className="text-[15px] font-semibold">
                      {role.company}
                      {role.companyNote && <span className="font-normal text-muted"> ({role.companyNote[l]})</span>}
                    </h3>
                    <span className="text-[11.5px] tabular-nums text-muted">{period(role.start, role.end, l)}</span>
                  </div>
                  <p className="text-muted">{role.title[l]}</p>
                  <ul className="mt-1.5 space-y-1">
                    {role.highlights.map((h) => (
                      <li key={h.en} className="avoid-break relative pl-3.5 before:absolute before:left-0 before:content-['–']">{h[l]}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <CvHeading className="mt-7">{ui.cv.projects[l]}</CvHeading>
            <div className="space-y-2.5">
              {cvProjects.map((p) => (
                <section key={p.slug} className="avoid-break">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="font-semibold">
                      {p.name}{' '}
                      <a href={p.links[0].href} className="font-normal text-blue">{p.links[0].href.replace(/^https:\/\/(github\.com\/)?/, '')}</a>
                    </h3>
                    <span className="text-[11.5px] tabular-nums text-muted">{p.year}</span>
                  </div>
                  <p>{p.cv![l]}</p>
                </section>
              ))}
            </div>
          </div>

          <aside className="space-y-6 text-[12.5px]">
            <div className="avoid-break">
              <CvHeading>{ui.cv.skills[l]}</CvHeading>
              <dl className="space-y-2">
                {skills.map((s) => (
                  <div key={s.group.en}>
                    <dt className="font-semibold">{s.group[l]}</dt>
                    <dd>{s.items}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="avoid-break">
              <CvHeading>{ui.cv.languages[l]}</CvHeading>
              <ul className="space-y-0.5">
                {languages.map((x) => (
                  <li key={x.name.en} className="flex justify-between gap-2"><span>{x.name[l]}</span><span className="text-muted">{x.level[l]}</span></li>
                ))}
              </ul>
            </div>

            <div className="avoid-break">
              <CvHeading>{ui.cv.education[l]}</CvHeading>
              <ul className="space-y-2">
                {education.map((e) => (
                  <li key={e.school}>
                    <p className="font-semibold">{e.program[l]}</p>
                    <p className="text-muted">{e.school}, {e.start}–{e.end}{e.note && ` (${e.note[l]})`}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="avoid-break">
              <CvHeading>{ui.cv.learning[l]}</CvHeading>
              <ul className="space-y-1">{learning.map((x) => <li key={x.en}>{x[l]}</li>)}</ul>
            </div>

            <div className="avoid-break">
              <CvHeading>{ui.cv.interests[l]}</CvHeading>
              <ul className="space-y-0.5">{interests.map((x) => <li key={x.en}>{x[l]}</li>)}</ul>
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}

function CvHeading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`mb-2.5 border-b border-ink pb-1 text-[13px] font-semibold ${className}`}>{children}</h2>;
}
