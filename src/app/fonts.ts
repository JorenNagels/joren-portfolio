import { Geist_Mono, Schibsted_Grotesk } from 'next/font/google';

// Schibsted Grotesk for everything you read; Geist Mono for the small map-style labels.
export const schibsted = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-schibsted', style: ['normal', 'italic'] });
export const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const fontVars = `${schibsted.variable} ${mono.variable}`;
