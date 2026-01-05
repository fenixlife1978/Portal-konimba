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
import { useAuthUser } from '@/firebase/provider'; 

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
 * It now robustly waits for user authentication to complete before fetching data.
 */
export function useCollection<T = any>(
  memoizedTargetRefOrQuery: CollectionReference<DocumentData> | Query<DocumentData> | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  const { user, loading: isAuthLoading } = useAuthUser();

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
    // 1. Si la autenticación está en curso o no hay una consulta válida, nos ponemos en estado de carga y esperamos.
    if (isAuthLoading || !memoizedTargetRefOrQuery) {
      setIsLoading(true);
      setData(null);
      setError(null);
      return;
    }

    // 2. Si la autenticación ha terminado pero no hay usuario, no hay nada que buscar.
    if (!user) {
        setIsLoading(false);
        setData(null);
        setError(null);
        return;
    }

    // 3. Si llegamos aquí, la autenticación está lista, hay un usuario y una consulta válida. Procedemos.
    setIsLoading(true);
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
        setData([]); 
        setIsLoading(false);

        errorEmitter.emit('permission-error', contextualError);
      }
    );

    // Limpieza al desmontar el componente o si la consulta cambia.
    return () => unsubscribe();
  }, [queryPath, user, isAuthLoading, memoizedTargetRefOrQuery]); // Dependencias correctas y completas.

  return { data, isLoading, error };
}
