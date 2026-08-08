import { useEffect, useState } from "react";

export default function App() {
  const [health, setHealth] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then(() => setHealth("ok"))
      .catch(() => setHealth("error"));
  }, []);

  return (
    <main>
      <h1>minigit2</h1>
      <p>Backend: {health}</p>
    </main>
  );
}
