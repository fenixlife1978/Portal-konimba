"use client";

import { useCollection } from "@/hooks/useCollection";
import { useAuth } from "@/firebase/provider"; // usamos el provider que ya creaste
import { Table, TableHead, TableRow, TableCell, TableBody } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ReceiptsPage() {
  const { user, loading: authLoading } = useAuth();

  // 🔑 Si aún está cargando la sesión
  if (authLoading) {
    return <p className="p-4 text-center">Cargando sesión...</p>;
  }

  // Si no hay usuario autenticado
  if (!user) {
    return (
      <div className="p-4">
        <Button asChild variant="outline">
          <Link href="/publisher">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al panel
          </Link>
        </Button>
        <p className="p-4 text-red-600 text-center mt-8">
          Debes iniciar sesión para ver tus recibos.
        </p>
      </div>
    );
  }

  // Consulta filtrada por el publisher actual
  const { data, loading, error } = useCollection("payments", {
    where: ["publisherId", "==", user.uid],
  });

  return (
    <div className="p-0">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Mis Recibos</h1>
        <Button asChild variant="outline">
          <Link href="/publisher">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al panel
          </Link>
        </Button>
      </div>

      {loading && <p className="p-4 text-center">Cargando recibos...</p>}

      {error && (
        <div className="p-4 text-red-600 text-center">
          Error al cargar recibos: {error.message}
        </div>
      )}

      {!loading && !error && (
        <>
          {(!data || data.length === 0) ? (
            <p className="p-4 text-gray-600 text-center">
              No tienes recibos disponibles
            </p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Monto</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((receipt: any) => (
                  <TableRow key={receipt.id}>
                    <TableCell>
                      {receipt.date
                        ? new Date(receipt.date.seconds * 1000).toLocaleDateString("es-VE")
                        : "—"}
                    </TableCell>
                    <TableCell>{receipt.amount ?? "—"} Bs</TableCell>
                    <TableCell>{receipt.status ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
