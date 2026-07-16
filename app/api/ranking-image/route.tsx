import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCountryLeaderboard } from "@/lib/db/leaderboard";
import { countryName, flagEmoji } from "@/lib/country";

export const runtime = "nodejs";

/** Story de Instagram (1080x1920) del ranking: Henry de fondo + la tabla + un
 *  mensaje competitivo. Datos reales; si no hay, una invitación. */
export async function GET() {
  const rows = await getCountryLeaderboard(5);
  const henry = await readFile(join(process.cwd(), "public/henry.jpg"));
  const henryUri = `data:image/jpeg;base64,${henry.toString("base64")}`;
  const size = { width: 1080, height: 1920 };

  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: "#14161b", color: "#fff" }}>
        {/* Henry de fondo (mitad superior) con degradado hacia el negro */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 940 }}>
          <img
            src={henryUri}
            width={1080}
            height={940}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(20,22,27,0.15) 30%, rgba(20,22,27,0.98) 100%)" }} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 6, padding: "0 70px 30px" }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 2, color: "#FCCC0A" }}>LA NUEVA YORK DE HENRY</div>
            <div style={{ fontSize: 74, fontWeight: 800, lineHeight: 1.05 }}>{`🏆 Los que más caminan Nueva York`}</div>
          </div>
        </div>

        {/* Tabla + mensaje */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "10px 70px 80px" }}>
          {rows.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {rows.map((r, i) => (
                <div
                  key={r.country}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: i === 0 ? "rgba(252,204,10,0.16)" : "rgba(255,255,255,0.06)",
                    border: i === 0 ? "2px solid rgba(252,204,10,0.5)" : "2px solid rgba(255,255,255,0.04)",
                    borderRadius: 20,
                    padding: "22px 30px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                    <div style={{ fontSize: 48, fontWeight: 800, color: i === 0 ? "#FCCC0A" : "#7f858e", width: 50 }}>{`${i + 1}`}</div>
                    <div style={{ fontSize: 52 }}>{flagEmoji(r.country)}</div>
                    <div style={{ fontSize: 46, fontWeight: 700 }}>{countryName(r.country)}</div>
                  </div>
                  <div style={{ fontSize: 40, fontWeight: 800, color: "#FCCC0A" }}>{`${r.steps.toLocaleString("es-PE")}`}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 56, fontWeight: 700, lineHeight: 1.2 }}>Sé el primero en sumar pasos a tu país 🚶</div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 50, fontWeight: 800, lineHeight: 1.15 }}>{`Yo ya estoy en la tabla 🚶`}</div>
            <div style={{ fontSize: 44, fontWeight: 600, color: "#FCCC0A" }}>{`¿Tu país va ganando?`}</div>
            <div style={{ fontSize: 32, fontWeight: 600, opacity: 0.75, marginTop: 12 }}>caminaconhenry.com</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
