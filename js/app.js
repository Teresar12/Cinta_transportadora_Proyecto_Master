/* =====================================================================
 * app.js — interfaz de usuario. Lee los controles, llama a
 * dimensionarCinta() (calculo.js) y pinta resultados, avisos, memoria
 * de cálculo y los tres diagramas SVG (dibujos.js). No contiene fórmulas.
 * ===================================================================== */
"use strict";

const $ = id => document.getElementById(id);
const TABLAS = {};

async function cargarJSON(ruta) {
  const resp = await fetch(ruta);
  if (!resp.ok) throw new Error("No se pudo leer " + ruta);
  return resp.json();
}

/* ---- Tema claro / oscuro ---- */
function aplicarTema(tema) {
  if (tema === "claro") document.documentElement.setAttribute("data-tema", "claro");
  else document.documentElement.removeAttribute("data-tema");
  $("btn-tema").textContent = tema === "claro" ? "🌙 Modo oscuro" : "☀️ Modo claro";
  $("btn-tema").setAttribute("aria-pressed", tema === "claro" ? "true" : "false");
}

function alternarTema() {
  const actual = document.documentElement.getAttribute("data-tema") === "claro" ? "claro" : "oscuro";
  const nuevo = actual === "claro" ? "oscuro" : "claro";
  try { localStorage.setItem("cinta-tema", nuevo); } catch (e) { /* sin almacenamiento: no se recuerda, pero funciona igual */ }
  aplicarTema(nuevo);
}

async function arrancar() {
  try {
    const [materiales, capacidades, parametros] = await Promise.all([
      cargarJSON("data/materiales.json"), cargarJSON("data/capacidades.json"), cargarJSON("data/parametros.json")
    ]);
    TABLAS.materiales = materiales; TABLAS.capacidades = capacidades; TABLAS.parametros = parametros;
    rellenarControlesEstaticos();
    enlazarEventos();
    aplicarTema(document.documentElement.getAttribute("data-tema") === "claro" ? "claro" : "oscuro");
    cargarEjemplo();
  } catch (err) {
    $("estado-carga").textContent = "No se pudieron cargar los archivos JSON. Abre la página con un servidor local (python3 -m http.server) o desde GitHub Pages: si abres el index.html con doble clic, el navegador bloquea la lectura de los JSON.";
    console.error(err);
  }
}

function opcion(select, valor, texto) {
  const o = document.createElement("option");
  o.value = valor; o.textContent = texto; select.appendChild(o); return o;
}

/* ---- Rellenar los desplegables que no cambian con los datos (tablas fijas) ---- */
function rellenarControlesEstaticos() {
  const P = TABLAS.parametros;
  rellenarMateriales();

  P.factorAlimentacionK1.forEach(o => opcion($("K1"), o.valor, `${o.nombre} (K₁ = ${o.valor.toFixed(2)})`));
  P.coeficienteRozamientoF.forEach(o => opcion($("f"), o.valor, `${o.nombre} (f = ${o.valor.toFixed(3)})`));
  P.rozamientoBandaTambor.forEach(o => opcion($("mu"), o.valor, `${o.nombre} (μ = ${o.valor.toFixed(2)})`));
  P.anguloAbrazamiento.forEach(o => opcion($("theta"), o.grados, o.nombre));
  P.tejidos.forEach(o => opcion($("tejido"), o.codigo, `${o.nombre} (${o.resistenciaKgfCm} kgf/cm)`));
  P.recubrimientos.forEach(o => opcion($("calidadRecubrimiento"), o.codigo, o.nombre));
  P.rodillos.diametros.forEach(d => opcion($("diametroRodillo"), d, `Ø ${d} mm`));
  P.diametrosTambor.forEach(d => opcion($("diametroTambor"), d, `Ø ${d} mm`));

  const dl = $("velocidades");
  P.velocidadesNormalizadas.forEach(v => { const o = document.createElement("option"); o.value = v; dl.appendChild(o); });
  const chips = $("chips-velocidad");
  P.velocidadesNormalizadas.forEach(v => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = v.toFixed(2);
    b.addEventListener("click", () => { $("v").value = v; $("v-rango").value = v; recalcular(); });
    chips.appendChild(b);
  });

  actualizarAnguloSobrecarga(null);
  actualizarEstacion();
}

function normalizarTexto(t) {
  return t.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function rellenarMateriales(filtro = "") {
  const sel = $("material");
  const actual = sel.value;
  sel.innerHTML = "";
  opcion(sel, "personalizado", "✎ Material personalizado");
  const f = normalizarTexto(filtro);
  TABLAS.materiales.lista
    .filter(m => !f || normalizarTexto(m.material).includes(f))
    .forEach(m => opcion(sel, m.clave, m.material));
  if ([...sel.options].some(o => o.value === actual)) sel.value = actual;
  else if (sel.options.length > 1) sel.selectedIndex = 1;
}

/* ---- Ángulo de sobrecarga β: lista fija de la tabla de capacidades,
   pero se preselecciona el recomendado según la fluidez del material. */
function actualizarAnguloSobrecarga(betaRecomendada) {
  const sel = $("beta");
  const actual = sel.value;
  sel.innerHTML = "";
  TABLAS.capacidades.betas.forEach(b => opcion(sel, b, `${b}°`));
  if (betaRecomendada !== null && TABLAS.capacidades.betas.includes(betaRecomendada)) sel.value = betaRecomendada;
  else if ([...sel.options].some(o => Number(o.value) === Number(actual))) sel.value = actual;
}

function materialActual() {
  const clave = $("material").value;
  if (clave === "personalizado") return null;
  return TABLAS.materiales.lista.find(m => m.clave === clave);
}

function alSeleccionarMaterial() {
  const m = materialActual();
  $("bloque-personalizado").hidden = !!m;
  if (!m) { $("ficha-material").hidden = true; return; }

  $("ficha-material").hidden = false;
  $("dato-pesorango").textContent = `${m.pesoMin} – ${m.pesoMax} t/m³`;
  $("dato-alfa").textContent = (m.alfaMin === null) ? "sin dato" : (m.alfaMin === m.alfaMax ? `${m.alfaMin}°` : `${m.alfaMin}–${m.alfaMax}°`);
  const alfaMedio = m.alfaMin === null ? null : (m.alfaMin + m.alfaMax) / 2;
  const clase = claseDeFluidez(alfaMedio, TABLAS.parametros);
  $("dato-fluidez").textContent = clase ? clase.clase : "sin dato (elige β)";
  $("dato-abrasividad").textContent = m.abrasividad;
  $("dato-corrosividad").textContent = m.corrosividad;

  $("pesoEspecifico-rango").min = m.pesoMin; $("pesoEspecifico-rango").max = m.pesoMax;
  $("pesoEspecifico").min = m.pesoMin; $("pesoEspecifico").max = m.pesoMax;
  $("pesoEspecifico").value = m.pesoMin; $("pesoEspecifico-rango").value = m.pesoMin;

  actualizarAnguloSobrecarga(clase ? clase.betaRecomendado : null);
}

/* ---- Tipo de estación: actualiza λ disponibles y anchos disponibles ---- */
function estacionActual() {
  const clave = document.querySelector('input[name="tipoEstacion"]:checked').value;
  return TABLAS.capacidades.estaciones.find(e => e.clave === clave);
}

function actualizarEstacion() {
  const est = estacionActual();
  const selLambda = $("lambda");
  const prevLambda = selLambda.value;
  selLambda.innerHTML = "";
  est.lambdas.forEach(l => opcion(selLambda, l, l === 0 ? "0° (plana)" : `${l}°`));
  if ([...selLambda.options].some(o => o.value === prevLambda)) selLambda.value = prevLambda;
  else if (est.lambdas.includes(30)) selLambda.value = "30";
  selLambda.disabled = est.lambdas.length === 1;

  const selAncho = $("anchoImpuesto");
  const prevAncho = selAncho.value;
  selAncho.innerHTML = "";
  opcion(selAncho, "0", "Automático (el menor que cumple)");
  est.anchos.forEach(b => opcion(selAncho, b, `${b} mm`));
  selAncho.value = [...selAncho.options].some(o => o.value === prevAncho) ? prevAncho : "0";
  $("rango-anchos").textContent = `Tab. ${est.tablaOrigen}: anchos de ${est.anchos[0]} a ${est.anchos[est.anchos.length - 1]} mm.`;
}

/* ---- Leer todos los controles y construir el objeto "entrada" ---- */
function leerEntrada() {
  const m = materialActual();
  return {
    Q: Number($("Q").value), v: Number($("v").value), L: Number($("L").value),
    inclinacion: Number($("inclinacion").value), pesoEspecifico: Number($("pesoEspecifico").value),
    K1: Number($("K1").value), beta: Number($("beta").value),
    abrasividad: m ? m.abrasividad : $("abras-pers").value,
    corrosividad: m ? m.corrosividad : $("corros-pers").value,
    terronMax: $("terronMax").value === "" ? 0 : Number($("terronMax").value),

    tipoEstacion: document.querySelector('input[name="tipoEstacion"]:checked').value,
    lambda: $("lambda").value, anchoImpuesto: Number($("anchoImpuesto").value),
    pasoCarga: Number($("pasoCarga").value), pasoRetorno: Number($("pasoRetorno").value),
    diametroRodillo: Number($("diametroRodillo").value),
    masaRodillosCarga: $("masaRodillosCarga").value === "" ? 0 : Number($("masaRodillosCarga").value),
    masaRodillosRetorno: $("masaRodillosRetorno").value === "" ? 0 : Number($("masaRodillosRetorno").value),

    tejido: $("tejido").value, coefSeguridad: Number($("coefSeguridad").value),
    calidadRecubrimiento: $("calidadRecubrimiento").value,
    espesorSuperior: Number($("espesorSuperior").value), espesorInferior: Number($("espesorInferior").value),
    mu: Number($("mu").value), theta: Number($("theta").value),
    diametroTambor: Number($("diametroTambor").value), rendimiento: Number($("rendimiento").value),
    f: Number($("f").value), coefCManual: $("coefCManual").value === "" ? 0 : Number($("coefCManual").value)
  };
}

/* ---- Recalcular y pintar ---- */
function recalcular() {
  const entrada = leerEntrada();
  const r = dimensionarCinta(entrada, TABLAS);

  if (r.error) {
    $("zona-error").hidden = false;
    $("zona-error").textContent = r.error;
    ["res-ancho", "res-llenado", "res-potencia", "res-t1", "res-designacion"].forEach(id => $(id).textContent = "—");
    $("lista-avisos").innerHTML = "";
    $("memoria-calculo").innerHTML = "";
    ["svg-seccion", "svg-capacidades", "svg-tensiones"].forEach(id => { while ($(id).firstChild) $(id).removeChild($(id).firstChild); });
    return;
  }
  $("zona-error").hidden = true;

  $("res-ancho").textContent = `${r.B} mm`;
  $("res-llenado").textContent = `${(r.grado_llenado * 100).toFixed(1)} %`;
  $("res-potencia").textContent = r.motorNormalizado ? `${r.motorNormalizado} kW` : `${(r.potenciaMotor / 1000).toFixed(1)} kW (fuera de catálogo)`;
  $("res-t1").textContent = `${(r.T1 / 1000).toFixed(2)} kN`;
  $("res-designacion").textContent = r.designacion;

  const lista = $("lista-avisos");
  lista.innerHTML = "";
  r.avisos.forEach(a => {
    const li = document.createElement("li");
    li.dataset.nivel = a.nivel; li.textContent = a.texto;
    lista.appendChild(li);
  });

  const memoria = $("memoria-calculo");
  memoria.innerHTML = "";
  r.memoria.forEach(p => {
    const li = document.createElement("li");
    const titulo = document.createElement("div"); titulo.className = "titulo"; titulo.textContent = p.titulo;
    li.appendChild(titulo);
    if (p.formula) { const f = document.createElement("div"); f.className = "formula"; f.textContent = p.formula; li.appendChild(f); }
    if (p.sustitucion) { const s = document.createElement("div"); s.className = "sustitucion"; s.textContent = p.sustitucion; li.appendChild(s); }
    const res = document.createElement("div"); res.className = "resultado"; res.textContent = p.resultado; li.appendChild(res);
    if (p.nota) { const n = document.createElement("div"); n.className = "nota"; n.textContent = p.nota; li.appendChild(n); }
    memoria.appendChild(li);
  });

  dibujarSeccion($("svg-seccion"), r);
  dibujarCapacidades($("svg-capacidades"), r);
  dibujarTensiones($("svg-tensiones"), r);
}

/* ---- Eventos ---- */
function enlazarPareja(idNum, idRango) {
  $(idNum).addEventListener("input", () => { $(idRango).value = $(idNum).value; recalcular(); });
  $(idRango).addEventListener("input", () => { $(idNum).value = $(idRango).value; recalcular(); });
}

function enlazarEventos() {
  $("buscador-material").addEventListener("input", e => { rellenarMateriales(e.target.value); alSeleccionarMaterial(); recalcular(); });
  $("material").addEventListener("change", () => { alSeleccionarMaterial(); recalcular(); });
  ["alfa-pers", "abras-pers", "corros-pers"].forEach(id => $(id).addEventListener("input", () => {
    if (id === "alfa-pers") {
      const clase = claseDeFluidez($("alfa-pers").value === "" ? null : Number($("alfa-pers").value), TABLAS.parametros);
      if (clase) actualizarAnguloSobrecarga(clase.betaRecomendado);
    }
    recalcular();
  }));

  enlazarPareja("pesoEspecifico", "pesoEspecifico-rango");
  enlazarPareja("Q", "Q-rango");
  enlazarPareja("v", "v-rango");
  enlazarPareja("L", "L-rango");
  enlazarPareja("inclinacion", "inclinacion-rango");

  document.querySelectorAll('input[name="tipoEstacion"]').forEach(r => r.addEventListener("change", () => { actualizarEstacion(); recalcular(); }));

  ["beta", "K1", "terronMax", "lambda", "anchoImpuesto", "pasoCarga", "pasoRetorno", "diametroRodillo",
    "masaRodillosCarga", "masaRodillosRetorno", "tejido", "coefSeguridad", "calidadRecubrimiento", "f",
    "espesorSuperior", "espesorInferior", "mu", "theta", "diametroTambor", "rendimiento", "coefCManual"
  ].forEach(id => $(id).addEventListener("input", recalcular));

  $("btn-ejemplo").addEventListener("click", cargarEjemplo);
  $("btn-imprimir").addEventListener("click", () => window.print());
  $("btn-tema").addEventListener("click", alternarTema);
}

/* ---- Ejemplo resuelto del Readme (para autoverificación y defensa) ---- */
function cargarEjemplo() {
  $("buscador-material").value = ""; rellenarMateriales();
  $("material").value = "caliza-fragmentada"; alSeleccionarMaterial();

  const valores = { Q: 500, v: 2, L: 120, inclinacion: 8 };
  for (const [id, x] of Object.entries(valores)) { $(id).value = x; $(id + "-rango").value = x; }
  $("pesoEspecifico").value = 1.36; $("pesoEspecifico-rango").value = 1.36;
  $("beta").value = 20; $("K1").value = 1; $("terronMax").value = "";

  document.querySelector('input[name="tipoEstacion"][value="tres"]').checked = true;
  actualizarEstacion();
  $("lambda").value = "30"; $("anchoImpuesto").value = "0";
  $("pasoCarga").value = 1.2; $("pasoRetorno").value = 3.0; $("diametroRodillo").value = "133";
  $("masaRodillosCarga").value = ""; $("masaRodillosRetorno").value = "";

  $("tejido").value = "L"; $("coefSeguridad").value = 10; $("calidadRecubrimiento").value = "B";
  $("f").value = "0.02"; $("espesorSuperior").value = 4; $("espesorInferior").value = 2;
  $("mu").value = "0.35"; $("theta").value = "210"; $("diametroTambor").value = "500";
  $("rendimiento").value = 0.9; $("coefCManual").value = "";

  recalcular();
}

arrancar();