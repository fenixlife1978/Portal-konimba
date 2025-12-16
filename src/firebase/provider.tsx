"use client";

import { ReactNode, useEffect, useState, createContext, useContext } from "react";
import { onAuthStateChanged, User, Auth } from "firebase/auth"; // Import Auth type
import { auth as firebaseAuth } from "@/firebase/config"; // renamed import
import { Firestore, getFirestore } from "firebase/firestore";
import { FirebaseStorage, getStorage } from "firebase/storage";
import { FirebaseApp } from "firebase/app";
import { firebaseApp } from ".";

// Tipo del contexto
type FirebaseContextType = {
  auth: Auth | null;
  db: Firestore | null;
  storage: FirebaseStorage | null;
  app: FirebaseApp | null;
  user: User | null;
  isUserLoading: boolean;
};

const FirebaseContext = createContext<FirebaseContextType>({
  auth: null,
  db: null,
  storage: null,
  app: null,
  user: null,
  isUserLoading: true,
});

// Provider que envuelve la app
export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  
  const auth = firebaseAuth;
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);
  const app = firebaseApp;


  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsUserLoading(false);
    });
    return () => unsub();
  }, [auth]);

  return (
    <FirebaseContext.Provider value={{ auth, db, storage, app, user, isUserLoading }}>
      {children}
    </FirebaseContext.Provider>
  );
}

// Hooks para consumir el contexto de forma separada
export const useAuth = () => useContext(FirebaseContext)?.auth;
export const useFirestore = () => useContext(FirebaseContext)?.db;
export const useStorage = () => useContext(FirebaseContext)?.storage;
export const useFirebaseApp = () => useContext(FirebaseContext)?.app;
export const useUser = () => {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error("useUser must be used within a FirebaseProvider");
    }
    return { user: context.user, isUserLoading: context.isUserLoading };
}
