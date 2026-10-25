/* =====================================================================
 * dibujos.js — diagramas técnicos en SVG (sin canvas, sin animación)
 * Reciben el resultado de dimensionarCinta() y dibujan sobre un <svg>
 * ya presente en la página. Se redibujan en cada recálculo.
 * ===================================================================== */
"use strict";

const NS = "http://www.w3.org/2000/svg";

/* Crea un elemento SVG.
   OJO: los atributos de presentación del SVG (fill="…", stroke="…") NO
   resuelven variables CSS: fill="var(--acento)" se queda sin color. Por eso
   cualquier valor que use var() se aplica como estilo en línea, que sí las
   resuelve; así los dibujos cambian de color al cambiar de tema. */
function crearEl(tipo, atributos) {
  const el = document.createElementNS(NS, tipo);
  for (const [k, v] of Object.entries(atributos)) {
    if (typeof v === "string" && v.includes("var(--")) el.style.setProperty(k, v);
    else el.setAttribute(k, v);
  }
  return el;
}

function limpiar(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }

/* ---------------------------------------------------------------------
 * 1. SECCIÓN CARGADA — esquema de la artesa con el material (no a escala
 *    geométrica real: es un esquema ilustrativo con los ángulos y el
 *    ancho B reales, para ver de un vistazo el tipo de estación elegido.
 * --------------------------------------------------------------------- */
function dibujarSeccion(svg, r) {
  limpiar(svg);
  const w = 420, h = 260;
  // ejeY deja sitio arriba para los dos rótulos y abajo para la cota de B
  const ejeY = 168, margenX = 60, anchoDibujo = w - margenX * 2;
  const numRodillos = r.entrada.tipoEstacion === "plana" ? 1 : r.entrada.tipoEstacion === "dos" ? 2
    : r.entrada.tipoEstacion === "cinco" ? 5 : 3;
  const lambda = Number(r.entrada.lambda) || 0;

  // puntos de apoyo de los rodillos (simplificado a un perfil poligonal)
  let puntos;
  if (numRodillos === 1) {
    puntos = [[margenX, ejeY], [margenX + anchoDibujo, ejeY]];
  } else {
    const inclinacionPx = Math.min(70, lambda * 1.5);
    const n = numRodillos;
    puntos = [];
    for (let i = 0; i <= n; i++) {
      const x = margenX + (anchoDibujo * i) / n;
      let y = ejeY;
      if (i === 0 || i === n) y = ejeY + inclinacionPx * 0.55;
      else if (n >= 5 && (i === 1 || i === n - 1)) y = ejeY - inclinacionPx * 0.55;
      else y = ejeY - inclinacionPx;
      puntos.push([x, y]);
    }
  }

  // bastidor / rodillos
  const grupoBastidor = crearEl("g", { stroke: "var(--borde-claro)", "stroke-width": 2, fill: "none" });
  grupoBastidor.appendChild(crearEl("polyline", { points: puntos.map(p => p.join(",")).join(" ") }));
  puntos.forEach(([x, y]) => grupoBastidor.appendChild(crearEl("circle", { cx: x, cy: y, r: 7, fill: "var(--panel)", stroke: "var(--borde-claro)" })));
  svg.appendChild(grupoBastidor);

  // material: polígono por encima del perfil, con el ángulo de sobrecarga β
  const beta = Number(r.entrada.beta) || 0;
  const alturaMaterial = 10 + Math.min(46, beta * 1.3);
  // tope superior: con λ y β grandes el material llegaría a los rótulos
  const yMaterial = Math.max(56, Math.min(...puntos.map(p => p[1])) - alturaMaterial);
  const materialPts = [puntos[0], [puntos[0][0] + 14, yMaterial], ...puntos.slice(1, -1).map(p => [p[0], yMaterial - 4]),
    [puntos[puntos.length - 1][0] - 14, yMaterial], puntos[puntos.length - 1]];
  svg.appendChild(crearEl("polygon", { points: materialPts.map(p => p.join(",")).join(" "), fill: "var(--acento)", "fill-opacity": "0.28", stroke: "var(--acento)", "stroke-width": 1.5 }));

  // cota del ancho B
  const yCota = ejeY + 46;
  const gCota = crearEl("g", { stroke: "var(--suave)", "stroke-width": 1 });
  gCota.appendChild(crearEl("line", { x1: margenX, y1: yCota, x2: margenX + anchoDibujo, y2: yCota }));
  gCota.appendChild(crearEl("line", { x1: margenX, y1: yCota - 5, x2: margenX, y2: yCota + 5 }));
  gCota.appendChild(crearEl("line", { x1: margenX + anchoDibujo, y1: yCota - 5, x2: margenX + anchoDibujo, y2: yCota + 5 }));
  svg.appendChild(gCota);

  const texto = (x, y, extra = {}) => crearEl("text", { x, y, fill: "var(--suave)", "font-size": 12, "text-anchor": "middle", ...extra });

  // Rótulos: los dos de arriba y la cota abajo, cada uno en su franja
  const tTitulo = texto(w / 2, 20, { fill: "var(--texto)", "font-size": 13 });
  const nombreEstacion = { plana: "Estación plana", dos: "2 rodillos (V)", tres: "3 rodillos (artesa)", cinco: "5 rodillos (guirnalda)" }[r.entrada.tipoEstacion];
  tTitulo.textContent = `${nombreEstacion} · λ = ${r.entrada.lambda}° · β = ${r.entrada.beta}°`;
  svg.appendChild(tTitulo);

  const tLlenado = texto(w / 2, 38, { fill: "var(--acento)", "font-size": 12 });
  tLlenado.textContent = `Grado de llenado: ${(r.grado_llenado * 100).toFixed(1)} %`;
  svg.appendChild(tLlenado);

  const tCota = texto(w / 2, yCota + 20); tCota.textContent = `B = ${r.B} mm`; svg.appendChild(tCota);
}

/* ---------------------------------------------------------------------
 * 2. CAPACIDAD POR ANCHO — barras horizontales: Q_max de cada ancho
 *    disponible frente al caudal Q pedido (línea vertical de referencia).
 * --------------------------------------------------------------------- */
function dibujarCapacidades(svg, r) {
  limpiar(svg);
  const w = 420, h = 260;
  const margen = { izq: 70, der: 16, sup: 10, inf: 26 };
  const opciones = r.opcionesAncho;
  const anchoUtil = w - margen.izq - margen.der;
  const altoFila = (h - margen.sup - margen.inf) / opciones.length;

  const qMaxima = Math.max(r.entrada.Q, ...opciones.map(o => o.IVT * r.entrada.v * r.factorK * r.entrada.K1 * r.entrada.pesoEspecifico)) * 1.08;
  const px = q => margen.izq + (q / qMaxima) * anchoUtil;

  opciones.forEach((o, i) => {
    const y = margen.sup + i * altoFila;
    const qmax = o.IVT * r.entrada.v * r.factorK * r.entrada.K1 * r.entrada.pesoEspecifico;
    const elegido = o.B === r.B;
    svg.appendChild(crearEl("rect", {
      x: margen.izq, y: y + altoFila * 0.18, width: Math.max(1, px(qmax) - margen.izq), height: altoFila * 0.64,
      fill: elegido ? "var(--acento)" : (o.cumple ? "var(--dato)" : "var(--borde-claro)"), "fill-opacity": elegido ? 1 : 0.75
    }));
    const et = crearEl("text", { x: margen.izq - 8, y: y + altoFila * 0.58, fill: "var(--suave)", "font-size": 11, "text-anchor": "end" });
    et.textContent = `${o.B}`;
    svg.appendChild(et);
  });

  // línea de caudal pedido
  const xQ = px(r.entrada.Q);
  svg.appendChild(crearEl("line", { x1: xQ, y1: margen.sup, x2: xQ, y2: h - margen.inf, stroke: "var(--mal)", "stroke-width": 1.5, "stroke-dasharray": "4,3" }));
  const etQ = crearEl("text", { x: xQ, y: h - margen.inf + 16, fill: "var(--mal)", "font-size": 11, "text-anchor": "middle" });
  etQ.textContent = `Q = ${r.entrada.Q} t/h`;
  svg.appendChild(etQ);

  const etEje = crearEl("text", { x: w - margen.der, y: margen.sup, fill: "var(--suave)", "font-size": 10, "text-anchor": "end" });
  etEje.textContent = "ancho (mm) → capacidad máxima (t/h)";
  svg.insertBefore(etEje, svg.firstChild);
}

/* ---------------------------------------------------------------------
 * 3. ESQUEMA DE TENSIONES — lazo cerrado con T1 (carga, al motriz),
 *    T2 (retorno, sale del motriz), T3 = T4 (tambor de cola).
 * --------------------------------------------------------------------- */
function dibujarTensiones(svg, r) {
  limpiar(svg);
  const w = 420, h = 220;
  const xMotriz = w - 90, xCola = 90, yCarga = 70, yRetorno = 150, radio = 22;

  const grupo = crearEl("g", { stroke: "var(--borde-claro)", "stroke-width": 2, fill: "none" });
  grupo.appendChild(crearEl("line", { x1: xCola, y1: yCarga, x2: xMotriz, y2: yCarga }));
  grupo.appendChild(crearEl("line", { x1: xCola, y1: yRetorno, x2: xMotriz, y2: yRetorno }));
  grupo.appendChild(crearEl("circle", { cx: xMotriz, cy: (yCarga + yRetorno) / 2, r: radio, fill: "var(--panel)" }));
  grupo.appendChild(crearEl("circle", { cx: xCola, cy: (yCarga + yRetorno) / 2, r: radio, fill: "var(--panel)" }));
  svg.appendChild(grupo);

  const flecha = (x, y, dx) => crearEl("polygon", {
    points: `${x},${y - 5} ${x},${y + 5} ${x + dx},${y}`, fill: "var(--dato)"
  });
  svg.appendChild(flecha((xCola + xMotriz) / 2 - 10, yCarga, 16));
  svg.appendChild(flecha((xCola + xMotriz) / 2 + 10, yRetorno, -16));

  const etiqueta = (x, y, texto, color) => {
    const t = crearEl("text", { x, y, fill: color || "var(--texto)", "font-size": 13, "text-anchor": "middle", "font-weight": 600 });
    t.textContent = texto; return t;
  };
  svg.appendChild(etiqueta((xCola + xMotriz) / 2, yCarga - 12, `T₁ = ${r.T1.toFixed(0)} N`, "var(--acento)"));
  svg.appendChild(etiqueta((xCola + xMotriz) / 2, yRetorno + 22, `T₂ = ${r.T2.toFixed(0)} N`, "var(--dato)"));
  svg.appendChild(etiqueta(xCola, yRetorno + radio + 20, `T₃ = T₄ = ${r.T3.toFixed(0)} N`, "var(--suave)"));
  svg.appendChild(etiqueta(xMotriz, (yCarga + yRetorno) / 2 + 4, "motriz", "var(--suave)"));
  svg.appendChild(etiqueta(xCola, (yCarga + yRetorno) / 2 + 4, "cola", "var(--suave)"));

  const cumple = r.relacionTensiones <= r.factorAdherencia + 1e-9;
  const t = crearEl("text", { x: w / 2, y: h - 14, "text-anchor": "middle", "font-size": 12, fill: cumple ? "var(--ok)" : "var(--mal)" });
  t.textContent = `T₁/T₂ = ${r.relacionTensiones.toFixed(2)}  ${cumple ? "≤" : ">"}  e^(μθ) = ${r.factorAdherencia.toFixed(2)}  →  ${cumple ? "no desliza" : "DESLIZA: revisar μ, θ o CS"}`;
  svg.appendChild(t);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { dibujarSeccion, dibujarCapacidades, dibujarTensiones };
}