"use client";
import React, { useState } from "react";

interface SubIdModalProps {
  onClose: () => void;
  onSave: (subId: string) => void;
}

export default function SubIdModal({ onClose, onSave }: SubIdModalProps) {
  const [subId, setSubId] = useState("");

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-white p-6 rounded shadow-md w-96">
        <h2 className="text-lg font-bold mb-4">Asignar / Modificar SUB ID</h2>

        <input
          type="text"
          placeholder="Escribe el SUB ID"
          value={subId}
          onChange={(e) => setSubId(e.target.value)}
          className="border p-2 w-full mb-4"
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
            Cancelar
          </button>
          <button
            onClick={() => onSave(subId)}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Guardar SUB ID
          </button>
        </div>
      </div>
    </div>
  );
}
