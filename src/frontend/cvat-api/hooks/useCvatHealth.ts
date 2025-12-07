import { useEffect, useState } from 'react';

export function useCvatHealth() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const resp = await fetch('http://localhost:3001/health/cvat');
        if (!resp.ok) throw new Error('Not OK');
        const json = await resp.json();
        if (!cancelled) {
          setStatus('ok');
          setDetails(json.about);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
        }
      }
    }

    check();
    const interval = setInterval(check, 3000); // poll every 3s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { status, details };
}
