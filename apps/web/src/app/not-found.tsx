import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="glass text-center p-10 max-w-sm w-full">
        <p className="text-6xl font-black mb-4" style={{ color: 'var(--blue)' }}>404</p>
        <p className="text-lg font-semibold mb-1">Page not found</p>
        <p className="text-sm text-gray-500 mb-6">This page doesn't exist or was moved.</p>
        <Link href="/"
          className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--blue)', color: '#fff' }}>
          ← Back to Live
        </Link>
      </div>
    </div>
  );
}
