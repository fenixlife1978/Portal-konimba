'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useAuthUser } from '@/firebase/provider'; // 👈 usamos el contexto de usuario autenticado

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };


export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}


export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Se asegura de esperar a que haya usuario autenticado antes de disparar la query.
 */
export function useCollection<T = any>(
  memoizedTargetRefOrQuery: CollectionReference<DocumentData> | Query<DocumentData> | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  const { user, loading } = useAuthUser(); // 👈 obtenemos el usuario actual

  const queryPath = useMemo(() => {
    if (!memoizedTargetRefOrQuery) return null;
    try {
      return (memoizedTargetRefOrQuery as any).type === 'collection'
        ? (memoizedTargetRefOrQuery as CollectionReference).path
        : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString();
    } catch {
     
      return JSON.stringify(memoizedTargetRefOrQuery);
    }
  }, [memoizedTargetRefOrQuery]);

  
  useEffect(() => {
    // 🚨 Si no hay usuario autenticado o aún está cargando, no disparamos la query
    if (loading || !user || !memoizedTargetRefOrQuery) {
      setIsLoading(true);
      setData(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = snapshot.docs.map(doc => ({
          ...(doc.data() as T),
          id: doc.id,
        }));
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        const path = queryPath || 'unknown_path';
        
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path,
        });

        console.warn("Firestore permission error caught:", contextualError);

        setError(contextualError);
        setData([]); // 👉 devolvemos array vacío
        setIsLoading(false);

        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [queryPath, user, loading]); // 👈 dependemos también de user y loading

  return { data, isLoading, error };
}
