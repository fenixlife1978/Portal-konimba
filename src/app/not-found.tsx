'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center">
      <h2 className="text-2xl font-bold">Página no encontrada</h2>
      <p className="mt-2 text-gray-600">
        Lo sentimos, no pudimos encontrar lo que buscabas.
      </p>
      <Link href="/" className="mt-4 text-blue-600 hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
