import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/site";

export const OG_ALT = "Casebook Timeline - detective fiction, arranged by year";

export const OG_SIZE = { width: 1200, height: 630 };

const SITE_HOST = new URL(SITE_URL).host;

export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0d0f12",
          color: "#e9e4d8",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            letterSpacing: 4,
            color: "#c39a4a",
          }}
        >
          <span>CASEBOOK TIMELINE</span>
          <span>EST. 2026</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              width: 120,
              height: 2,
              background: "#c39a4a",
              marginBottom: 36,
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 82,
              lineHeight: 1.08,
              letterSpacing: -1,
            }}
          >
            <span>Detective fiction,</span>
            <span>arranged by year.</span>
          </div>
          <div style={{ marginTop: 28, fontSize: 28, color: "#b5afa2" }}>
            A timeline archive of mysteries, authors and series.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#7e786c",
          }}
        >
          <span>{SITE_HOST}</span>
          <span>READ / RATE / COLLECT</span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
