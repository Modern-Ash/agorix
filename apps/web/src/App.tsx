import { PACKAGE_NAME } from "@agorix/program-model";

/** Placeholder shell proving the web app can import a shared domain package (issue #11, R3). */
export function App() {
  return (
    <main>
      <h1>Agorix</h1>
      <p>Skeleton wired to {PACKAGE_NAME}.</p>
    </main>
  );
}
