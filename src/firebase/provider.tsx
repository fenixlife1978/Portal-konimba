'use client';

import { createContext, useContext, ReactNode } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { FirebaseStorage } from 'firebase/storage';
import { initializeFirebase } from '@/firebase/index';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

// Define la estructura del contexto de Firebase
interface FirebaseContextValue {
  firebaseApp: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}

// Crea el contexto de Firebase
const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

/**
 * Proveedor principal de Firebase.
 * Inicializa los servicios de Firebase y los pone a disposición de toda la aplicación.
 */
export function FirebaseProvider({ children }: { children: ReactNode }) {
  // Inicializa Firebase de forma idempotente
  const firebaseServices = initializeFirebase();

  return (
    <FirebaseContext.Provider value={firebaseServices}>
      {children}
      {/* El listener de errores es crucial para el debugging de reglas de seguridad */}
      <FirebaseErrorListener />
    </FirebaseContext.Provider>
  );
}

// Hooks para consumir el contexto de Firebase de forma segura

/**
 * Hook para obtener la instancia de la aplicación de Firebase.
 * @returns La instancia de FirebaseApp.
 */
export function useFirebaseApp(): FirebaseApp {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebaseApp must be used within a FirebaseProvider');
  }
  return context.firebaseApp;
}

/**
 * Hook para obtener la instancia del servicio de Autenticación de Firebase.
 * @returns La instancia de Auth.
 */
export function useAuth(): Auth {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a FirebaseProvider');
  }
  return context.auth;
}

/**
 * Hook para obtener la instancia del servicio de Firestore.
 * @returns La instancia de Firestore.
 */
export function useFirestore(): Firestore {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirestore must be used within a FirebaseProvider');
  }
  return context.db;
}

/**
 * Hook para obtener la instancia del servicio de Storage de Firebase.
 * @returns La instancia de FirebaseStorage.
 */
export function useStorage(): FirebaseStorage {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useStorage must be used within a FirebaseProvider');
  }
  return context.storage;
}

/**
 * Hook para obtener el objeto completo del contexto de Firebase.
 * @returns El objeto con todas las instancias de servicios de Firebase.
 */
export function useFirebase(): FirebaseContextValue {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
      throw new Error('useFirebase must be used within a FirebaseProvider');
    }
    return context;
}
