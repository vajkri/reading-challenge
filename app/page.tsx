// TEMPORARY Phase-1 verification gallery — renders the ported MascotFace at all
// 8 happiness stages for cat + dog so the renderer can be eyeballed against the
// prototype's maskot-table. Replaced by <AppShell/> once the screens land.
import MascotFace from "@/components/MascotFace";
import type { AnimalKey, Stage } from "@/lib/types";

const STAGES: Stage[] = [0, 1, 2, 3, 4, 5, 6, 7];
const STAGE_LABELS = ["0–9%", "10–24%", "25–49%", "50–74%", "75–89%", "90–99%", "100%", "101%+"];
const ANIMALS: AnimalKey[] = ["cat", "dog"];

export default function Gallery() {
  return (
    <main style={{ minHeight: "100dvh", background: "#FFF6E9", padding: "2rem", color: "#4F4034" }}>
      <h1 style={{ fontWeight: 800, fontSize: "1.5rem" }}>MascotFace — Phase 1 verification</h1>
      <p style={{ color: "#8A7559" }}>cat + dog across happiness stages 0–7</p>
      {ANIMALS.map((animal) => (
        <section key={animal} style={{ marginTop: "1.5rem" }}>
          <h2 style={{ textTransform: "capitalize", fontWeight: 700 }}>{animal}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {STAGES.map((stage) => (
              <div key={stage} style={{ textAlign: "center" }}>
                <div style={{ width: 150, height: 162 }}>
                  <MascotFace animal={animal} stage={stage} bob={false} />
                </div>
                <small style={{ color: "#A9967E" }}>{STAGE_LABELS[stage]}</small>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
