"use client";

import { useEffect, useRef } from "react";

type LaneNumber = 1 | 2 | 3;

interface Props {
  activeLane?: LaneNumber;
  onLaneChange?: (lane: LaneNumber) => void;
}

// Coordinate transform: lon/lat → SVG pixel
const S = 2.91;
const rnd = (v: number) => Math.round(v * 10) / 10;
const coord = (lon: number, lat: number): [number, number] => [
  rnd(20 + (lon + 25) * S),
  rnd(20 + (82 - lat) * S),
];

type Pt = string | [number, number];

interface LaneDef {
  name: string;
  color: string;
  baseWidth: number;
  dashArray: string;
  pts: Pt[];
}

const PORTS: Record<string, [number, number, number, number, string]> = {
  JPOSA: [135.43, 34.65, 9, 4, "start"],
  CNNGB: [121.55, 29.87, -8, -6, "end"],
  TWKHH: [120.3, 22.6, 8, 4, "start"],
  CNXMN: [118.07, 24.45, -9, -1, "end"],
  SGSIN: [103.8, 1.26, 0, 18, "middle"],
  KRPUS: [129.04, 35.1, -8, -6, "end"],
  RUPEV: [170.3, 69.7, 8, -6, "start"],
  RUSBW: [73, 72.8, 0, -11, "middle"],
  NLRTM: [4.1, 52, -32, -10, "end"],
  ESVLC: [-0.3, 39.47, -9, -3, "end"],
  ITGIT: [15.9, 38.43, 10, 12, "start"],
  FRFOS: [4.9, 43.4, 10, -9, "start"],
};

const LANE_DEFS: LaneDef[] = [
  {
    name: "Lane 1 · Cape of Good Hope",
    color: "#1D9E75",
    baseWidth: 4,
    dashArray: "",
    pts: [
      "JPOSA",[133,33.2],[128,31.5],[123,30.3],"CNNGB",
      [120.8,27.5],[119.6,25],[119.6,23.4],"TWKHH",
      [118,20.5],[114,15.5],[110,9],[106,4.5],"SGSIN",
      [101.5,2.3],[99,4],[97,5.7],[94,6.3],[88,5],[80,4],[75,0],
      [66,-12],[56,-24],[44,-33],[30,-36.5],[20,-36.5],[14,-33],
      [10,-22],[8,-9],[5,-2],[2,2],[-5,2],[-13,4],[-18,9],
      [-20,15],[-20,22],[-18,27],[-13,33],[-10,36],[-7.5,36],
      [-5.6,36],[-3,36.2],[0,37.5],[1.5,38.8],"ESVLC",
      [1.5,39.9],[3.6,41.2],[4.5,42.4],"FRFOS",
    ],
  },
  {
    name: "Lane 2 · Suez Canal",
    color: "#D85A30",
    baseWidth: 2.4,
    dashArray: "7 4",
    pts: [
      "JPOSA",[133,33.2],[128,31.5],[124,30.5],"CNNGB",
      [121,27.8],[119.5,25.4],"CNXMN",
      [116.5,22.3],[113.5,18.5],[110,11],[106,5],"SGSIN",
      [102,2.2],[99,4],[97,5.7],[92,6.3],[85,6.3],[80,5],
      [72,7.5],[62,11.5],[54,13],[48,13],[45.5,12.2],[43.5,12.7],
      [41.5,14.5],[39.5,18],[37.5,21.5],[35.5,25],[34,28],[33,29.5],
      [32.5,30],[32.4,31],[31,32.4],[26,33.6],[21,34.8],[17,36.8],
      [15.8,37.5],[15.7,38.1],"ITGIT",
      [14,39.7],[11,40.3],[8,41.7],[6,42.5],"FRFOS",
    ],
  },
  {
    name: "Lane 3 · Arctic (NSR)",
    color: "#7F77DD",
    baseWidth: 2.4,
    dashArray: "2 4",
    pts: [
      "JPOSA",[133,33.5],[131,34.3],"KRPUS",
      [131.5,38],[135.5,40.5],[138,41.5],[140.7,41.5],[144,41.3],
      [148,43],[153,47],[159,50],[163,50],[166,55],[170,58.8],
      [178,60.5],[184,62.5],[188.5,64],[191.2,66.2],[189.3,68],
      [184,69.3],[178,70.3],[172,71],"RUPEV",
      [162,71.3],[152,72.7],[142,73.8],[132,74.2],[122,75.3],
      [112,77.5],[104,78.6],[96,77.6],[88,76.6],[80,75.2],[75,74.3],"RUSBW",
      [71.5,74.3],[66,74],[62,72.5],[59,70.3],[52,71],[45,70.8],
      [38,71.3],[31,71.8],[25.5,72.3],[20,71.5],[13,70],[7,67.5],
      [3,63.5],[2,60],[3,57],[3.5,54.5],[3.5,53],"NLRTM",
      [3,52.2],[2.3,51.3],[-1,49.9],[-4,49.6],[-6,48.6],[-6.5,46.5],
      [-6,44.5],[-10.5,42.5],[-10.5,39],[-10,36.3],[-7,35.9],
      [-5.6,36],[-2.5,36.5],[0.5,38],[2.5,39.8],[4,41.5],"FRFOS",
    ],
  },
];

const LAND: [number, number][][] = [
  [[-9,37],[-9,43.5],[-1.8,43.4],[-1.2,46],[-4.5,48.5],[-1.5,49.5],[2,51],[5,53],[8.5,54],[8.5,57],[10.5,57.7],[10.5,55],[14,54],[21,55],[24,57],[23,59.5],[28.5,59.7],[30,60],[33,66],[33,69.5],[40,67],[44,68.5],[50,68],[60,69.5],[66,69],[67,71],[70,73],[80,73.5],[87,75],[95,76],[104,77.7],[108,76],[113,73.7],[125,73],[130,71.5],[140,72.5],[150,71.5],[160,69.5],[170,70],[180,69],[185,68],[190,66],[188,65],[183,64.5],[178,64.5],[179,62.5],[172,61],[167,60],[163,59.5],[163,57],[162,55],[158,52.5],[156.7,51],[155.8,55],[156,57.5],[160,61.5],[155,59.5],[150,59.5],[143,59],[138,56],[135,54.5],[141,53],[140,48],[138,46],[132,43],[129.5,41],[128,39],[129.5,36],[127,34.5],[126,37],[125,39.5],[121.5,39],[122,37],[119,37],[121,34],[122,31],[121.5,28],[119,25.5],[117,23],[113,22],[110,20.5],[108,21],[106,18],[108,15],[109,11.5],[105,9],[104,10.5],[100.5,13],[99.5,10],[100,7],[101,3],[103.5,1.4],[100.5,5.5],[98.5,8],[98.5,14],[97,16.5],[94,17],[93,20],[91,22.5],[87,21.5],[85,19.5],[81,16],[80,13],[79.5,10],[77.5,8],[76,10.5],[73,17],[72.5,21],[70,21],[67,24.5],[62,25],[57,26],[54,27],[50,29.5],[48,30],[49,27],[51,25],[52,24],[56,24.5],[56.5,26],[59,22.5],[55,17],[52,16],[44,12.8],[43,13],[42.8,15.5],[39,21],[35,28],[34.5,28.5],[34.2,31.2],[35,33],[36,36.5],[30,36.5],[27,37],[26.5,40],[24,38],[23,36.5],[24,38],[23,40.5],[20.5,40],[19.5,42],[15,45],[13.5,45.5],[12.3,44.5],[13.5,43.5],[14,42],[16,41.8],[18.5,40.2],[17,39],[16.6,38.2],[15.7,37.95],[15.9,38.6],[15.8,39.8],[14,40.8],[12,41.7],[10.5,43],[9,44.3],[7,43.7],[5,43.3],[3,43.3],[3,42],[0.5,40.5],[0,39.5],[-0.5,38.5],[-2,36.8],[-5,36]],
  [[5,58.2],[5,61],[8,63.5],[12,66],[15,68.5],[20,70],[25,71],[31,70],[30,66],[30,61],[26,60.3],[22,60.3],[21.5,63],[24,65.7],[20,63.5],[17.5,62],[18.5,59.5],[16.5,56.5],[13,55.5],[11.5,58],[8,58]],
  [[-17,21],[-16,15],[-17,14.7],[-13,9],[-8,4.5],[-2,5],[4,6],[9,4],[9,0],[12,-5],[13,-12],[12,-17],[15,-27],[18,-32],[19,-34.5],[25,-34],[32,-28.5],[35,-23],[35,-18],[40,-15],[40,-10],[39,-5],[42,0],[51,11.5],[44,11],[43,12.5],[39,15],[37,21],[33,28],[32.5,30],[30,31],[25,32],[20,31],[15,32.5],[10,34],[10,37],[5,36.7],[-2,35],[-6,35.8],[-10,30],[-13,27]],
  [[-5,50],[1.3,51.2],[2,53],[-1.5,55.5],[-3,58.5],[-6,57],[-3,55],[-5,52]],
  [[130.8,31],[132,34],[135,34],[136,34.5],[140,35],[141,38],[141.5,41],[140,40],[139.5,38],[136.5,37],[135,35.7],[131,34.5]],
  [[140,42],[145,43.5],[142,45.5],[140,43]],
  [[120.2,22.5],[121.5,25.2],[122,24.5],[121,22]],
  [[95.3,5.6],[98,4],[100,2],[104,-1.5],[106,-3],[106,-5.9],[104,-5.5],[101,-2.5],[98,0.5],[95.5,3]],
  [[105,-6.5],[114,-7.5],[114,-8.5],[106,-7.5]],
  [[109,1],[111,2],[115,5],[119,5],[117,1],[116,-4],[110,-3]],
  [[131,-1],[141,-2.5],[150,-10],[141,-9],[138,-8]],
  [[114,-22],[122,-18],[130,-12],[137,-12],[141,-17],[146,-19],[153,-26],[151,-34],[146,-39],[138,-35],[131,-31.5],[115,-34],[113,-26]],
  [[191,64],[195,64],[195,70],[194,71],[192,68],[191.8,65.6]],
];

export default function LaneMap({ activeLane, onLaneChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathsRef = useRef<SVGPathElement[]>([]);
  const drawnRef = useRef(false);
  const cbRef = useRef(onLaneChange);
  cbRef.current = onLaneChange;

  // Draw the map once after mount
  useEffect(() => {
    if (drawnRef.current || !svgRef.current) return;
    drawnRef.current = true;

    const svg = svgRef.current;
    const NS = "http://www.w3.org/2000/svg";

    function el<T extends Element>(
      tag: string,
      attrs: Record<string, string | number>,
      parent: Element = svg,
    ): T {
      const e = document.createElementNS(NS, tag) as unknown as T;
      for (const k in attrs) e.setAttribute(k, String(attrs[k]));
      parent.appendChild(e);
      return e;
    }

    // Ocean
    el("rect", { x: 0, y: 0, width: 680, height: 400, fill: "#bfdbfe" });

    // Land polygons
    LAND.forEach((poly) => {
      const d = "M" + poly.map((p) => coord(p[0], p[1]).join(",")).join("L") + "Z";
      el("path", { d, fill: "#cbd5e1", stroke: "#94a3b8", "stroke-width": 0.3 });
    });

    // Route paths
    pathsRef.current = LANE_DEFS.map((lane, i) => {
      const pts = lane.pts.map((p) =>
        typeof p === "string"
          ? coord(PORTS[p][0], PORTS[p][1])
          : coord(p[0], p[1]),
      );
      let d = "M" + pts[0].join(",");
      for (let j = 1; j < pts.length - 1; j++) {
        d +=
          "Q" + pts[j].join(",") + " " +
          rnd((pts[j][0] + pts[j + 1][0]) / 2) + "," +
          rnd((pts[j][1] + pts[j + 1][1]) / 2);
      }
      d += "L" + pts[pts.length - 1].join(",");

      const path = el<SVGPathElement>("path", {
        d,
        fill: "none",
        stroke: lane.color,
        "stroke-width": lane.baseWidth,
        "stroke-dasharray": lane.dashArray,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        style: `transition:opacity 0.15s${cbRef.current ? ";cursor:pointer" : ""}`,
      });
      if (cbRef.current) {
        path.addEventListener("click", () => cbRef.current!((i + 1) as LaneNumber));
      }
      return path;
    });

    // Port dots + labels
    Object.entries(PORTS).forEach(([code, [lon, lat, dx, dy, anchor]]) => {
      const [cx, cy] = coord(lon, lat);
      const big = code === "JPOSA" || code === "FRFOS";
      el("circle", {
        cx, cy,
        r: big ? 5.5 : 3,
        fill: "#f8fafc",
        stroke: "#1e293b",
        "stroke-width": big ? 2 : 1.5,
      });
      const t = el<SVGTextElement>("text", {
        x: cx + dx,
        y: cy + dy,
        "text-anchor": anchor,
        "dominant-baseline": "central",
        style: "font-size:10px;font-weight:500;fill:#1e293b;font-family:ui-sans-serif,system-ui,sans-serif",
      });
      t.textContent = code;
    });

    // Lane name labels
    function lbl(x: number, y: number, text: string) {
      const t = el<SVGTextElement>("text", {
        x, y,
        style: "font-size:10px;fill:#475569;font-family:ui-sans-serif,system-ui,sans-serif",
      });
      t.textContent = text;
    }
    lbl(145, 376, "Cape of Good Hope");
    lbl(192, 174, "Suez Canal");
    lbl(406, 24, "Northern Sea Route");
  }, []);

  // Update route highlight when active lane changes
  useEffect(() => {
    pathsRef.current.forEach((path, i) => {
      const opacity = activeLane === undefined ? "0.9" : i + 1 === activeLane ? "0.95" : "0.2";
      path.setAttribute("opacity", opacity);
    });
  }, [activeLane]);

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-blue-200">
      <svg
        ref={svgRef}
        width="100%"
        viewBox="0 0 680 400"
        className="block"
        role="img"
        aria-label="Shipping lanes map from Osaka to Fos-sur-Mer"
      />
      {onLaneChange && (
        <div className="flex flex-wrap gap-2 px-4 py-3 bg-white border-t border-slate-100">
          {LANE_DEFS.map((lane, i) => {
            const active = activeLane === i + 1;
            return (
              <button
                key={i}
                onClick={() => onLaneChange((i + 1) as LaneNumber)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors border"
                style={{
                  borderColor: active ? lane.color : "#e2e8f0",
                  color: active ? lane.color : "#64748b",
                  fontWeight: active ? 600 : 400,
                  background: active ? `${lane.color}18` : "transparent",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 20,
                    height: 0,
                    borderTop: `2.5px ${i === 0 ? "solid" : i === 1 ? "dashed" : "dotted"} ${active ? lane.color : "#94a3b8"}`,
                  }}
                />
                {lane.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
