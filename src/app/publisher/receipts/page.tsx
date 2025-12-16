'use client';

import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config'; // ajusta la ruta a tu config
import { useAuth } from '@/firebase/auth-context'; // tu hook/context de auth
import { useCollection } from '@/firebase/firestore/use-collection';

export default function PublisherReceiptsPage() {
  const { currentUser } = useAuth();

  // Memoizamos la query para evitar renders infinitos
  const receiptsQuery = useMemo(() => {
    if (!currentUser) return null;
    return query(
      collection(db, 'payments'),
      where('publisherId', '==', currentUser.uid)
    );
  }, [currentUser]);

  const { data, isLoading, error } = useCollection<any>(receiptsQuery);

  if (isLoading) {
    return <p className="p-4">Cargando tus recibos...</p>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        Error al cargar recibos: {error.message}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Mis Recibos</h1>

      {data && data.length > 0 ? (
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border">Fecha</th>
              <th className="px-4 py-2 border">Monto</th>
              <th className="px-4 py-2 border">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.map((receipt) => (
              <tr key={receipt.id}>
                <td className="px-4 py-2 border">
                  {receipt.date
                    ? new Date(receipt.date.seconds * 1000).toLocaleDateString('es-VE')
                    : '—'}
                </td>
                <td className="px-4 py-2 border">{receipt.amount ?? '—'} Bs</td>
                <td className="px-4 py-2 border">{receipt.status ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-gray-600">No tienes recibos disponibles.</p>
      )}
    </div>
  );
}
