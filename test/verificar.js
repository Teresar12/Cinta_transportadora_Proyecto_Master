const { dimensionarCinta } = require("../js/calculo.js");
const materiales = require("../data/materiales.json");
const capacidades = require("../data/capacidades.json");
const parametros = require("../data/parametros.json");

const entrada = {
  Q: 500, v: 2, L: 120, inclinacion: 8, pesoEspecifico: 1.36, K1: 1,
  tipoEstacion: "tres", lambda: 30, beta: 20, anchoImpuesto: 0,
  pasoCarga: 1.2, pasoRetorno: 3.0, diametroRodillo: 133,
  masaRodillosCarga: 0, masaRodillosRetorno: 0,
  f: 0.02, coefCManual: 0,
  mu: 0.35, theta: 210, diametroTambor: 500, rendimiento: 0.9,
  tejido: "L", coefSeguridad: 10, espesorSuperior: 4, espesorInferior: 2,
  calidadRecubrimiento: "B", abrasividad: "B", corrosividad: "A", terronMax: 0
};

const r = dimensionarCinta(entrada, { materiales, capacidades, parametros });
if (r.error) { console.error("ERROR:", r.error); process.exit(1); }

const esperado = {
  B: 800, caudalMaximo: 734.0, grado_llenado: 0.681, fuerzaTangencial: 15572,
  potenciaMotor_kW: 34.60, motorNormalizado: 37, T1: 22368, T2: 6796, T3: 5810,
  telas: 5, desarrolloRedondeado: 242
};

function check(nombre, obtenido, esperado, tol) {
  const ok = Math.abs(obtenido - esperado) <= tol;
  console.log(`${ok ? "OK " : "MAL"}  ${nombre}: obtenido=${obtenido}  esperado=${esperado}  (tol ${tol})`);
  return ok;
}

let todoOk = true;
todoOk &= check("Ancho B (mm)", r.B, esperado.B, 0);
todoOk &= check("Q_max (t/h)", Number(r.caudalMaximo.toFixed(1)), esperado.caudalMaximo, 0.5);
todoOk &= check("Grado de llenado", Number(r.grado_llenado.toFixed(3)), esperado.grado_llenado, 0.002);
todoOk &= check("F_U (N)", Number(r.fuerzaTangencial.toFixed(0)), esperado.fuerzaTangencial, 5);
todoOk &= check("P_M (kW)", Number((r.potenciaMotor/1000).toFixed(2)), esperado.potenciaMotor_kW, 0.05);
todoOk &= check("Motor normalizado (kW)", r.motorNormalizado, esperado.motorNormalizado, 0);
todoOk &= check("T1 (N)", Number(r.T1.toFixed(0)), esperado.T1, 5);
todoOk &= check("T2 (N)", Number(r.T2.toFixed(0)), esperado.T2, 5);
todoOk &= check("T3 (N)", Number(r.T3.toFixed(0)), esperado.T3, 5);
todoOk &= check("Nº telas", r.telas, esperado.telas, 0);
todoOk &= check("Desarrollo banda (m)", r.desarrolloRedondeado, esperado.desarrolloRedondeado, 0);

console.log("\nDesignación:", r.designacion, " (esperada: 800 B – 5L/40-20 des242 UNE 18025)");
console.log(todoOk ? "\n✔ TODO CORRECTO" : "\n✘ HAY DISCREPANCIAS");
process.exit(todoOk ? 0 : 1);
