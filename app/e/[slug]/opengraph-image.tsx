import { ImageResponse } from "next/og";
import { getExperienceDetail } from "@/lib/db/detail";
import { metersToSteps } from "@/lib/steps";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "La Nueva York de Henry";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exp = await getExperienceDetail(slug);
  const steps = metersToSteps(exp?.distanceM ?? null);
  const barrio = exp?.neighborhood ?? exp?.city ?? "Nueva York";
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
          padding: 80,
        }}
      >
        <div style={{ fontSize: 30, opacity: 0.7 }}>La Nueva York de Henry · by Resilentos</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {steps && (
            <div style={{ fontSize: 96, fontWeight: 800, color: "#FCCC0A" }}>
              {`${steps.toLocaleString("es-PE")} pasos`}
            </div>
          )}
          <div style={{ fontSize: 56, fontWeight: 700 }}>{`por ${barrio}, con Henry`}</div>
        </div>
        <div style={{ fontSize: 30, opacity: 0.7 }}>caminaconhenry.com</div>
      </div>
    ),
    { ...size }
  );
}
