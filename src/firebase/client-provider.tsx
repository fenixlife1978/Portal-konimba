"use client";
// This file is now redundant. The logic has been moved to provider.tsx.
// It is kept temporarily to prevent breaking imports. It can be safely removed
// once all imports are updated to point to the new FirebaseProvider.
import { ReactNode } from "react";
import { FirebaseProvider as NewFirebaseProvider } from "./provider";

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  return <NewFirebaseProvider>{children}</NewFirebaseProvider>;
}
