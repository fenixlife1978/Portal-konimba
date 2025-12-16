import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";

type Condition = [string, any, any];

export function useCollection(
  path: string,
  options?: { where?: Condition }
) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const q = options?.where
          ? query(collection(db, path), where(...options.where))
          : collection(db, path);

        const snapshot = await getDocs(q);
        setData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [path, JSON.stringify(options)]);

  return { data, loading, error };
}
