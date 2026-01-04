'use client';

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Auth, onAuthStateChanged, User } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { FirebaseStorage } from 'firebase/storage';
import { initializeFirebase } from '@/firebase/index';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

// -----------------------------------------------------------------------------
// Contexto de Firebase (app, auth, db, storage)
// -----------------------------------------------------------------------------

interface FirebaseContextValue {
  firebaseApp: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}


const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);


export function FirebaseProvider({ children }: { children: ReactNode }) {
 
  const firebaseServices = initializeFirebase();

  return (
    <FirebaseContext.Provider value={firebaseServices}>
      {children}
  
      <FirebaseErrorListener />
    </FirebaseContext.Provider>
  );
}

export function useFirebaseApp(): FirebaseApp {
  const context = useContext(FirebaseContext);
  if (!context) throw new Error('useFirebaseApp must be used within a FirebaseProvider');
  return context.firebaseApp;
}


export function useAuth(): Auth {
  const context = useContext(FirebaseContext);
  if (!context) throw new Error('useAuth must be used within a FirebaseProvider');
  return context.auth;
}


export function useFirestore(): Firestore {
  const context = useContext(FirebaseContext);
  if (!context) throw new Error('useFirestore must be used within a FirebaseProvider');
  return context.db;
}


export function useStorage(): FirebaseStorage {
  const context = useContext(FirebaseContext);
  if (!context) throw new Error('useStorage must be used within a FirebaseProvider');
  return context.storage;
}


export function useFirebase(): FirebaseContextValue {
  const context = useContext(FirebaseContext);
  if (!context) throw new Error('useFirebase must be used within a FirebaseProvider');
  return context;
}

// -----------------------------------------------------------------------------
// Contexto de Usuario autenticado (AuthState)
// -----------------------------------------------------------------------------

interface AuthUserContextValue {
  user: User | null;
  loading: boolean;
}

const AuthUserContext = createContext<AuthUserContextValue>({
  user: null,
  loading: true,
});

export function AuthUserProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  return (
    <AuthUserContext.Provider value={{ user, loading }}>
      {children}
    </AuthUserContext.Provider>
  );
}

export function useAuthUser(): AuthUserContextValue {
  return useContext(AuthUserContext);
}
