'use client';

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="font-semibold underline hover:text-blue">
      {label}
    </button>
  );
}
