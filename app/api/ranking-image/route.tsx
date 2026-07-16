import { ImageResponse } from "next/og";
import { getCountryLeaderboard } from "@/lib/db/leaderboard";
import { countryName } from "@/lib/country";

export const runtime = "nodejs";

/** Imagen del ranking de países para compartir (1200x630). Datos reales; si no
 *  hay, una invitación a ser el primero. */
export async function GET() {
  const rows = await getCountryLeaderboard(5);
  const size = { width: 1200, height: 630 };

  const body =
    rows.length > 0 ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
        {rows.map((r, i) => (
          <div
            key={r.country}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: i === 0 ? "rgba(252,204,10,0.14)" : "rgba(255,255,255,0.05)",
              borderRadius: 16,
              padding: "16px 26px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: i === 0 ? "#FCCC0A" : "#8a8f98", width: 46 }}>
                {`${i + 1}`}
              </div>
              <div style={{ fontSize: 44, fontWeight: 700 }}>{countryName(r.country)}</div>
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, color: "#FCCC0A" }}>
              {`${r.steps.toLocaleString("es-PE")} pasos`}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div style={{ display: "flex", fontSize: 52, fontWeight: 700, lineHeight: 1.2 }}>
        Sé el primero en sumar pasos a tu país
      </div>
    );

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#14161b",
          color: "#fff",
          padding: 70,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 30, opacity: 0.7 }}>La Nueva York de Henry · by Resilentos</div>
          <div style={{ fontSize: 54, fontWeight: 800 }}>Los que más caminan NYC 🌎</div>
        </div>
        {body}
        <div style={{ fontSize: 28, opacity: 0.7 }}>caminaconhenry.com</div>
      </div>
    ),
    { ...size }
  );
}
