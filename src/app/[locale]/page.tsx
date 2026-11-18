import Link from 'next/link';
import { LangSwitch } from '@/components/LangSwitch';
import { Motion } from '@/components/Motion';
import { Music } from '@/components/Music';
import { streetCopy } from '@/components/street/copy';
import { Street } from '@/components/street/Street';
import { experience, person } from '@/content/profile';
import { experiments, projects } from '@/content/projects';
import type { Locale } from '@/content/types';
import { period, ui } from '@/content/ui';

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale: l } = await params;

  return (
    <>
      <Motion />
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-end px-4 text-sm sm:px-8">
        <nav className="nav-plate relative flex items-center gap-5 rounded-full border border-white/15 bg-black/50 px-4 py-2 text-white shadow-[0_2px_14px_rgba(0,0,0,0.35)] backdrop-blur-md">
          <Music locale={l} />
          <Link href={`/${l}/cv/`} className="hover:underline">{ui.nav.cv[l]}</Link>
          <LangSwitch locale={l} />
        </nav>
      </header>

      <main>
        <Street locale={l} />
        <Plain l={l} />
      </main>
    </>
  );
}

/**
 * The same content as a normal page. With WebGL it is only there for screen readers and search engines
 * (html.walk hides it visually); without WebGL it is the page.
 */
function Plain({ l }: { l: Locale }) {
  return (
    <div className="plain mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-8">
      <p className="text-muted">{streetCopy.role[l]}</p>
      <h1 className="mt-2 text-6xl font-semibold tracking-[-0.05em]">{person.name}</h1>

      <h2 className="mt-16 text-2xl font-semibold">{ui.work.title[l]}</h2>
      {experience.map((r) => (
        <section key={r.company} className="mt-8">
          <h3 className="text-xl font-semibold">{r.company}</h3>
          <p className="text-muted">{r.title[l]}, {period(r.start, r.end, l)}</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {r.highlights.map((h) => <li key={h.en}>{h[l]}</li>)}
          </ul>
        </section>
      ))}

      <h2 className="mt-16 text-2xl font-semibold">{ui.projects.title[l]}</h2>
      {projects.map((p) => (
        <section key={p.slug} className="mt-8">
          <h3 className="text-xl font-semibold">{p.name}</h3>
          <p className="text-muted">{p.kind[l]}, {p.year}</p>
          <p className="mt-2">{p.tagline[l]}</p>
          {p.story[l].split('\n\n').map((para) => <p key={para} className="mt-2">{para}</p>)}
          {p.detail && <p className="mt-2">{p.detail[l]}</p>}
          <p className="mt-2 text-muted">{p.stack.join(', ')}</p>
          <p className="mt-2 flex gap-4">
            {p.links.map((x) => <a key={x.href} href={x.href} className="underline">{x.label[l]}</a>)}
          </p>
        </section>
      ))}

      <h2 className="mt-16 text-2xl font-semibold">{ui.projects.small[l]}</h2>
      <ul className="mt-4 space-y-2">
        {experiments.map((e) => <li key={e.name}><strong>{e.name}</strong> ({e.year}): {e.text[l]}</li>)}
      </ul>

      <h2 className="mt-16 text-2xl font-semibold">{ui.contact.title[l]}</h2>
      <p className="mt-4"><a href={`mailto:${person.email}`} className="text-3xl underline">{person.email}</a></p>
      <p className="mt-4 flex gap-6">
        <a href={person.github} className="underline">GitHub</a>
        <Link href={`/${l}/cv/`} className="underline">{ui.contact.cv[l]}</Link>
      </p>
    </div>
  );
}
