"use client";

import dynamic from "next/dynamic";
import { useRef, useEffect, useState, useCallback } from "react";

// react-force-graph-2d uses browser-only APIs (canvas, requestAnimationFrame)
// dynamic import with ssr:false is required even inside "use client" components
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

/* ─── Types ─────────────────────────────────────────────────────────────── */
export interface BridgeTarget {
    target_name: string;
    target_slug: string;
    bridge_name: string;
    bridge_slug: string;
    path_strength: number;
}

export interface Connection {
    name: string;
    slug: string;
    headline: string;
}

interface GraphNode {
    id: string;
    name: string;
    type: "user" | "bridge" | "target" | "connection";
    slug?: string;
}

interface GraphLink {
    source: string;
    target: string;
    strength: number;
}

interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

/* ─── Colors ─────────────────────────────────────────────────────────────── */
const NODE_COLORS: Record<string, string> = {
    user:       "#2563eb",  // accent blue — current user
    bridge:     "#f59e0b",  // amber — bridge contacts
    target:     "#94a3b8",  // slate — reachable targets
    connection: "#10b981",  // green — direct connections (fallback mode)
};

/* ─── Data builders ──────────────────────────────────────────────────────── */
function buildFromBridges(bridges: BridgeTarget[], userName: string): GraphData {
    const nodes = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    const linkSet = new Set<string>();

    nodes.set("__me__", { id: "__me__", name: userName, type: "user" });

    bridges.forEach(b => {
        if (b.bridge_slug && !nodes.has(b.bridge_slug)) {
            nodes.set(b.bridge_slug, {
                id: b.bridge_slug,
                name: b.bridge_name || b.bridge_slug,
                type: "bridge",
                slug: b.bridge_slug,
            });
        }
        if (b.target_slug && !nodes.has(b.target_slug)) {
            nodes.set(b.target_slug, {
                id: b.target_slug,
                name: b.target_name || b.target_slug,
                type: "target",
                slug: b.target_slug,
            });
        }
        const l1 = `__me__→${b.bridge_slug}`;
        if (!linkSet.has(l1)) {
            links.push({ source: "__me__", target: b.bridge_slug, strength: b.path_strength });
            linkSet.add(l1);
        }
        const l2 = `${b.bridge_slug}→${b.target_slug}`;
        if (!linkSet.has(l2)) {
            links.push({ source: b.bridge_slug, target: b.target_slug, strength: b.path_strength });
            linkSet.add(l2);
        }
    });

    return { nodes: [...nodes.values()], links };
}

function buildFromConnections(connections: Connection[], userName: string): GraphData {
    const nodes: GraphNode[] = [
        { id: "__me__", name: userName, type: "user" },
        ...connections.slice(0, 50).map(c => ({
            id: c.slug,
            name: c.name,
            type: "connection" as const,
            slug: c.slug,
        })),
    ];
    const links = connections.slice(0, 50).map(c => ({
        source: "__me__",
        target: c.slug,
        strength: 1,
    }));
    return { nodes, links };
}

/* ─── Legend ─────────────────────────────────────────────────────────────── */
function Legend({ hasBridges }: { hasBridges: boolean }) {
    const items = hasBridges
        ? [
            { color: NODE_COLORS.user,   label: "Tu" },
            { color: NODE_COLORS.bridge, label: "Bridge contact" },
            { color: NODE_COLORS.target, label: "Target raggiungibile" },
        ]
        : [
            { color: NODE_COLORS.user,       label: "Tu" },
            { color: NODE_COLORS.connection, label: "Connessione diretta" },
        ];

    return (
        <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
            {items.map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                    {item.label}
                </div>
            ))}
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                Click su un nodo → apre il profilo LinkedIn
            </div>
        </div>
    );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
interface Props {
    bridges: BridgeTarget[];
    connections: Connection[];
    userName: string;
}

export default function NetworkGraph({ bridges, connections, userName }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 600, height: 480 });

    useEffect(() => {
        if (!containerRef.current) return;
        const obs = new ResizeObserver(entries => {
            const { width } = entries[0].contentRect;
            setDimensions({ width, height: 480 });
        });
        obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    const hasBridges = bridges.length > 0;
    const graphData = hasBridges
        ? buildFromBridges(bridges, userName)
        : buildFromConnections(connections, userName);

    const maxStrength = Math.max(...graphData.links.map(l => l.strength), 1);

    const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const r = node.type === "user" ? 9 : node.type === "bridge" ? 6 : 4;
        const fontSize = Math.max(10 / globalScale, 3);

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = NODE_COLORS[node.type] || "#94a3b8";
        ctx.fill();

        if (node.type === "user") {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI);
            ctx.strokeStyle = "rgba(37,99,235,0.3)";
            ctx.lineWidth = 2 / globalScale;
            ctx.stroke();
        }

        if (globalScale >= 0.6) {
            const firstName = (node.name || "").split(" ")[0];
            ctx.font = `${node.type === "user" ? "bold " : ""}${fontSize}px Inter, system-ui, sans-serif`;
            ctx.fillStyle = "#1a1a24";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(firstName, node.x, node.y + r + 2 / globalScale);
        }
    }, []);

    const handleNodeClick = useCallback((node: any) => {
        if (node.slug) {
            window.open(`https://www.linkedin.com/in/${node.slug}`, "_blank", "noopener,noreferrer");
        }
    }, []);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Legend hasBridges={hasBridges} />
            {!hasBridges && (
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic", margin: 0 }}>
                    Modalità base — connessioni dirette. Continua a navigare su LinkedIn per sbloccare la mappa bridge.
                </p>
            )}
            <div ref={containerRef} style={{
                width: "100%",
                height: 480,
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid var(--border-soft)",
                background: "#fcfcfd",
            }}>
                <ForceGraph2D
                    graphData={graphData}
                    width={dimensions.width}
                    height={dimensions.height}
                    backgroundColor="#fcfcfd"
                    nodeCanvasObject={nodeCanvasObject}
                    nodeCanvasObjectMode={() => "replace"}
                    linkWidth={(link: any) => 0.5 + (link.strength / maxStrength) * 2.5}
                    linkColor={() => "rgba(37,99,235,0.12)"}
                    onNodeClick={handleNodeClick}
                    nodeLabel={(node: any) => node.name}
                    cooldownTicks={120}
                    d3AlphaDecay={0.02}
                    d3VelocityDecay={0.3}
                />
            </div>
        </div>
    );
}
