import { useEffect, useMemo } from "react";
import Icon from "../ui/Icon";
import { extraerWikilinks } from "../../services/supabase/notasPersonalesService";

const ANCHO = 640;
const ALTO = 420;
const ITERACIONES = 200;

/**
 * Grafo de enlaces [[Título]] entre las notas del usuario. Simulación de fuerzas hecha a
 * mano (repulsión entre nodos + resorte por enlace) — de sobra para unas cuantas decenas
 * de notas, no hace falta traer d3 ni ninguna librería de grafos para esto.
 */
export default function NotasGrafo({ notas, onCerrar, onIrANota }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  const { nodos, enlaces } = useMemo(() => {
    const porTitulo = new Map(notas.map((n) => [n.titulo.toLowerCase(), n]));
    const vistos = new Set();
    const enlaces = [];
    for (const n of notas) {
      for (const destino of extraerWikilinks(n.cuerpo)) {
        const objetivo = porTitulo.get(destino.toLowerCase());
        if (!objetivo || objetivo.id === n.id) continue;
        const clave = [n.id, objetivo.id].sort().join("|");
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        enlaces.push({ a: n.id, b: objetivo.id });
      }
    }

    const pos = new Map(notas.map((n, i) => {
      const ang = (i / notas.length) * Math.PI * 2;
      return [n.id, { x: ANCHO / 2 + Math.cos(ang) * 130, y: ALTO / 2 + Math.sin(ang) * 130 }];
    }));
    for (let iter = 0; iter < ITERACIONES; iter++) {
      const fuerza = new Map(notas.map((n) => [n.id, { x: 0, y: 0 }]));
      for (let i = 0; i < notas.length; i++) {
        for (let j = i + 1; j < notas.length; j++) {
          const a = pos.get(notas[i].id), b = pos.get(notas[j].id);
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = Math.max(dx * dx + dy * dy, 0.01);
          const d = Math.sqrt(d2);
          const f = 2200 / d2;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          fuerza.get(notas[i].id).x += fx; fuerza.get(notas[i].id).y += fy;
          fuerza.get(notas[j].id).x -= fx; fuerza.get(notas[j].id).y -= fy;
        }
      }
      for (const { a, b } of enlaces) {
        const pa = pos.get(a), pb = pos.get(b);
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const f = (d - 110) * 0.02;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        fuerza.get(a).x += fx; fuerza.get(a).y += fy;
        fuerza.get(b).x -= fx; fuerza.get(b).y -= fy;
      }
      for (const n of notas) {
        const p = pos.get(n.id);
        const f = fuerza.get(n.id);
        p.x += f.x * 0.5 + (ANCHO / 2 - p.x) * 0.002;
        p.y += f.y * 0.5 + (ALTO / 2 - p.y) * 0.002;
        p.x = Math.max(24, Math.min(ANCHO - 24, p.x));
        p.y = Math.max(24, Math.min(ALTO - 24, p.y));
      }
    }

    const nodos = notas.map((n) => ({
      ...n, ...pos.get(n.id),
      enlazada: enlaces.some((e) => e.a === n.id || e.b === n.id),
    }));
    return { nodos, enlaces };
  }, [notas]);

  return (
    <div className="mc-modal-overlay" onClick={onCerrar} role="presentation">
      <div className="mc-modal notas-grafo-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="notas-grafo-head">
          <h2>Grafo de notas</h2>
          <button type="button" className="icon-edit" onClick={onCerrar} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </button>
        </div>
        {enlaces.length === 0 ? (
          <p className="notas-grafo-vacio">
            Todavía no hay enlaces entre notas — escribe <code>[[Título de otra nota]]</code> en
            el cuerpo de una nota para verlo aquí.
          </p>
        ) : (
          <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="notas-grafo-svg">
            {enlaces.map((e, i) => {
              const a = nodos.find((n) => n.id === e.a);
              const b = nodos.find((n) => n.id === e.b);
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="notas-grafo-linea" />;
            })}
            {nodos.map((n) => (
              <g key={n.id} className="notas-grafo-nodo" onClick={() => onIrANota(n)}>
                <circle cx={n.x} cy={n.y} r={n.enlazada ? 8 : 6} />
                <text x={n.x} y={n.y - 12} textAnchor="middle">{n.titulo}</text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
