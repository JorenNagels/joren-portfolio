import { experience } from '@/content/profile';
import { projects } from '@/content/projects';
import type { Locale } from '@/content/types';
import { streetCopy as t } from './copy';

// What each poster is about, and its name in the street's menu. No three.js in here, so the page can use it
// before the 3D code has loaded.

export type Kind = 'about' | 'work' | 'project' | 'small' | 'contact';
export function kindOf(id: string): Kind {
  if (id === 'about' || id === 'small' || id === 'contact') return id;
  if (projects.some((p) => p.slug === id)) return 'project';
  return 'work';
}

export function labelOf(id: string, l: Locale) {
  const k = kindOf(id);
  if (k === 'project') return projects.find((p) => p.slug === id)!.name;
  if (k === 'work') return experience.find((r) => r.company.toLowerCase() === id)!.company;
  return t[k][l];
}
