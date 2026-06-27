// Phase 0 placeholder — used only to smoke-test the GitHub Pages deploy
// (basePath + .nojekyll + static export). Replaced by the real app in Phase 1+.
export default function Home() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "#FFF6E9",
        color: "#4F4034",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <div>
        <div style={{ fontSize: "3rem" }}>📚🦊</div>
        <h1 style={{ margin: "0.5rem 0", fontSize: "1.6rem", fontWeight: 800 }}>
          Læseudfordring
        </h1>
        <p style={{ color: "#8A7559", margin: 0 }}>Kommer snart…</p>
      </div>
    </main>
  );
}
