import '../globals.css';
import { fontVars } from '../fonts';

// Root "/" only picks a language and redirects; the real site lives under /nl and /en.
export default function RootRedirectLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
