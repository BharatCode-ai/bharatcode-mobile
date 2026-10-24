import { useEffect, useState } from "react";
export function useResource<T>(key: string, load: () => Promise<T>) {
  const [result, setResult] = useState<{
    key: string;
    data?: T;
    error?: string;
  }>();
  useEffect(() => {
    let alive = true;
    void load()
      .then((data) => {
        if (alive) setResult({ key, data });
      })
      .catch((e) => {
        if (alive)
          setResult({ key, error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      alive = false;
    };
  }, [key, load]);
  return {
    loading: result?.key !== key,
    data: result?.key === key ? result.data : undefined,
    error: result?.key === key ? result.error : undefined,
  };
}
