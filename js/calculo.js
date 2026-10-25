/* =====================================================================
 * calculo.js — MOTOR DE CÁLCULO del dimensionado de cintas transportadoras
 * ---------------------------------------------------------------------
 * Función pura: dimensionarCinta(entrada, tablas) -> resultado
 * No lee el DOM ni dibuja nada; por eso se puede probar sola con Node
 * (ver /test/verificar.js) y reutilizar igual en la página web.
 *
 * Método y fuentes (ver Readme.txt, apartado 4):
 *   - Apuntes de "Transporte y Manutención Industrial" (USAL).
 *   - Rulmeca: Tab. 2 (materiales), Tab. 5a-5d (capacidad volumétrica),
 *     Tab. 6 (factor K de inclinación).
 *   - DIN 22101: resistencias al avance (coeficiente C) y potencia.
 *   - UNE 18025: designación y nº de telas de la banda.
 * ===================================================================== */
"use strict";

const GRADOS_A_RAD = Math.PI / 180;

/** Interpolación lineal en una tabla de pares (ejesX, ejesY) creciente en X. */
function interpolarLineal(ejesX, ejesY, x) {
  if (x <= ejesX[0]) return ejesY[0];
  if (x >= ejesX[ejesX.length - 1]) return ejesY[ejesY.length - 1];
  for (let i = 1; i < ejesX.length; i++) {
    if (x <= ejesX[i]) {
      const t = (x - ejesX[i - 1]) / (ejesX[i] - ejesX[i - 1]);
      return ejesY[i - 1] + t * (ejesY[i] - ejesY[i - 1]);
    }
  }
  return ejesY[ejesY.length - 1];
}

/** Clase de fluidez y beta recomendada a partir del ángulo de reposo alfa. */
function claseDeFluidez(alfa, parametros) {
  if (alfa === null || alfa === undefined || Number.isNaN(alfa)) return null;
  const clases = parametros.fluidez.clases;
  for (const c of clases) if (alfa <= c.alfaMax) return c;
  return clases[clases.length - 1];
}

/**
 * Dimensiona una cinta transportadora completa.
 * @param {object} entrada  datos introducidos por el usuario (ver Readme §3)
 * @param {object} tablas   { materiales, capacidades, parametros } (los 3 JSON)
 * @returns {object} resultado con error, o con todos los valores + memoria de cálculo
 */
function dimensionarCinta(entrada, tablas) {
  const PAR = tablas.parametros;
  const CAP = tablas.capacidades;
  const g = PAR.gravedad;

  const memoria = [];
  const avisos = [];
  const anotar = (titulo, formula, sustitucion, resultado, nota) =>
    memoria.push({ titulo, formula, sustitucion, resultado, nota: nota || "" });
  const advertir = (nivel, texto) => avisos.push({ nivel, texto });

  // -------------------- 0. VALIDACIÓN DE ENTRADA --------------------
  const obligatorios = {
    "Caudal Q": entrada.Q, "Velocidad v": entrada.v, "Longitud L": entrada.L,
    "Peso específico": entrada.pesoEspecifico, "Paso de rodillos de carga": entrada.pasoCarga,
    "Paso de rodillos de retorno": entrada.pasoRetorno, "Rendimiento del accionamiento": entrada.rendimiento,
    "Diámetro de tambor": entrada.diametroTambor, "Coeficiente de seguridad": entrada.coefSeguridad
  };
  for (const [nombre, valor] of Object.entries(obligatorios)) {
    if (!(valor > 0)) return { error: `«${nombre}» debe ser un número mayor que cero.` };
  }
  if (entrada.inclinacion < 0 || entrada.inclinacion > 20) {
    return { error: "La inclinación debe estar entre 0° y 20° (rango de validez del factor K, Rulmeca Tab. 6)." };
  }
  if (entrada.rendimiento > 1) return { error: "El rendimiento debe expresarse entre 0 y 1." };

  const estacion = CAP.estaciones.find(es => es.clave === entrada.tipoEstacion);
  if (!estacion) return { error: "Tipo de estación no reconocido." };
  const lambdaClave = String(entrada.lambda);
  if (!estacion.lambdas.map(String).includes(lambdaClave)) {
    return { error: `La estación «${estacion.nombre}» no admite λ = ${entrada.lambda}°.` };
  }
  if (!CAP.betas.includes(Number(entrada.beta))) {
    return { error: "Ángulo de sobrecarga β no disponible en las tablas de capacidad." };
  }

  // ====================================================================
  // PASO 1 — CAPACIDAD VOLUMÉTRICA Y ANCHO DE BANDA (Rulmeca)
  // ====================================================================
  const caudalVolumetrico = entrada.Q / entrada.pesoEspecifico; // m3/h
  anotar("Caudal volumétrico de material", "I_M = Q / q_s",
    `${entrada.Q} t/h / ${entrada.pesoEspecifico} t/m³`, `${caudalVolumetrico.toFixed(2)} m³/h`);

  const factorK = interpolarLineal(PAR.factorInclinacionK.delta, PAR.factorInclinacionK.K, entrada.inclinacion);
  anotar("Factor de reducción por inclinación (Rulmeca, Tab. 6)", "K = f(δ)",
    `δ = ${entrada.inclinacion}°`, factorK.toFixed(3), "Interpolación lineal entre los valores de la tabla.");

  anotar("Factor de irregularidad de alimentación", "K₁", "dato elegido", entrada.K1.toFixed(2));

  const caudalEquivalente = caudalVolumetrico / (factorK * entrada.K1); // m3/h, horizontal, a v real
  anotar("Caudal volumétrico equivalente", "I_VM = I_M / (K · K₁)",
    `${caudalVolumetrico.toFixed(2)} / (${factorK.toFixed(3)} · ${entrada.K1.toFixed(2)})`, `${caudalEquivalente.toFixed(2)} m³/h`);

  const capacidadNecesaria = caudalEquivalente / entrada.v; // m3/h a v = 1 m/s
  anotar("Capacidad volumétrica necesaria a v = 1 m/s", "I_VT,nec = I_VM / v",
    `${caudalEquivalente.toFixed(2)} / ${entrada.v}`, `${capacidadNecesaria.toFixed(2)} m³/h`,
    `Se busca en la Tab. ${estacion.tablaOrigen} (${estacion.nombre}, λ = ${lambdaClave}°, β = ${entrada.beta}°).`);

  const erratas = CAP.erratasCatalogo || [];
  const opcionesAncho = estacion.anchos.map(B => {
    const IVT = estacion.capacidad[String(B)][lambdaClave][CAP.betas.indexOf(Number(entrada.beta))];
    const errata = erratas.find(e => e.estacion === entrada.tipoEstacion && e.ancho === B &&
      String(e.lambda) === lambdaClave && e.beta === Number(entrada.beta));
    return { B, IVT, cumple: IVT >= capacidadNecesaria, errata: errata || null };
  });

  let elegido;
  if (entrada.anchoImpuesto && Number(entrada.anchoImpuesto) > 0) {
    elegido = opcionesAncho.find(o => o.B === Number(entrada.anchoImpuesto));
    if (!elegido) return { error: "El ancho impuesto no está disponible para esta estación." };
  } else {
    elegido = opcionesAncho.find(o => o.cumple);
    if (!elegido) {
      const mayor = opcionesAncho[opcionesAncho.length - 1];
      return {
        error: `Ningún ancho de la Tab. ${estacion.tablaOrigen} alcanza la capacidad necesaria ` +
          `(I_VT,nec = ${capacidadNecesaria.toFixed(1)} m³/h; máximo disponible ${mayor.IVT.toFixed(1)} m³/h con B = ${mayor.B} mm). ` +
          `Prueba con más velocidad, más ángulo de artesa o más rodillos.`,
        opcionesAncho, capacidadNecesaria
      };
    }
  }
  const B = elegido.B;
  const Bm = B / 1000;
  const grado_llenado = capacidadNecesaria / elegido.IVT;
  const caudalMaximo = elegido.IVT * entrada.v * factorK * entrada.K1 * entrada.pesoEspecifico; // t/h

  anotar("Ancho de banda", "menor B con I_VT(B) ≥ I_VT,nec",
    `B = ${B} mm → I_VT = ${elegido.IVT} m³/h`, `B = ${B} mm`,
    entrada.anchoImpuesto ? "Ancho fijado por el usuario." : "Automático: el menor normalizado que cumple.");
  anotar("Capacidad máxima de la cinta elegida", "Q_max = I_VT · v · K · K₁ · q_s",
    `${elegido.IVT} · ${entrada.v} · ${factorK.toFixed(3)} · ${entrada.K1.toFixed(2)} · ${entrada.pesoEspecifico}`,
    `${caudalMaximo.toFixed(1)} t/h`, `Grado de llenado = ${(grado_llenado * 100).toFixed(1)} %`);

  if (grado_llenado > 1) advertir("error", `El ancho impuesto (B = ${B} mm) no tiene capacidad suficiente (llenado ${(grado_llenado * 100).toFixed(1)} %). Elige un ancho mayor o pon el ancho en automático.`);
  if (elegido.errata) advertir("aviso", `El valor de tabla usado (I_VT = ${elegido.IVT} m³/h) está marcado como posible errata del catálogo: ${elegido.errata.motivo}`);

  // ====================================================================
  // PASO 2 — GEOMETRÍA Y CARGAS LINEALES (kg/m)
  // ====================================================================
  const deltaRad = entrada.inclinacion * GRADOS_A_RAD;
  const altura = entrada.L * Math.sin(deltaRad);
  anotar("Altura a elevar", "H = L · sen δ", `${entrada.L} · sen ${entrada.inclinacion}°`, `${altura.toFixed(2)} m`);

  const cargaMaterial = entrada.Q / (3.6 * entrada.v);
  anotar("Masa de material por metro de cinta", "q_G = Q / (3,6 · v)",
    `${entrada.Q} / (3,6 · ${entrada.v})`, `${cargaMaterial.toFixed(2)} kg/m`);

  const masaRodilloUnitKg = PAR.rodillos.masaGiratoriaKgM[String(entrada.diametroRodillo)];
  const longitudRodillo = PAR.rodillos.factorLongitud * Bm;
  const masaEstacionCarga = (entrada.masaRodillosCarga && entrada.masaRodillosCarga > 0)
    ? entrada.masaRodillosCarga : masaRodilloUnitKg * longitudRodillo;
  const masaEstacionRetorno = (entrada.masaRodillosRetorno && entrada.masaRodillosRetorno > 0)
    ? entrada.masaRodillosRetorno : masaRodilloUnitKg * longitudRodillo;
  const cargaRodillosCarga = masaEstacionCarga / entrada.pasoCarga;
  const cargaRodillosRetorno = masaEstacionRetorno / entrada.pasoRetorno;
  anotar("Masa giratoria de rodillos de carga por metro", "q_RO = m_RO / a_o",
    `${masaEstacionCarga.toFixed(2)} kg / ${entrada.pasoCarga} m`, `${cargaRodillosCarga.toFixed(2)} kg/m`,
    entrada.masaRodillosCarga ? "Masa por estación introducida por el usuario." : `Estimada: Ø${entrada.diametroRodillo} mm → ${masaRodilloUnitKg} kg/m de rodillo.`);
  anotar("Masa giratoria de rodillos de retorno por metro", "q_RU = m_RU / a_u",
    `${masaEstacionRetorno.toFixed(2)} kg / ${entrada.pasoRetorno} m`, `${cargaRodillosRetorno.toFixed(2)} kg/m`);

  const coefC = (entrada.coefCManual && entrada.coefCManual > 0)
    ? entrada.coefCManual : interpolarLineal(PAR.coeficienteC.L, PAR.coeficienteC.C, entrada.L);
  anotar("Coeficiente de resistencias secundarias (DIN 22101)", "C = f(L)",
    `L = ${entrada.L} m`, coefC.toFixed(3), entrada.coefCManual ? "Valor introducido por el usuario." : "Interpolación en la tabla de DIN 22101.");

  const tejido = PAR.tejidos.find(t => t.codigo === entrada.tejido);
  const densidadGoma = PAR.densidadGomaKgM2mm;
  const flecha = PAR.flechaAdmisible;
  const factorAdherencia = Math.exp(entrada.mu * entrada.theta * GRADOS_A_RAD);
  const cosDelta = Math.cos(deltaRad);

  // ---- Iteración: el peso de la banda depende del nº de telas, y el nº de
  // telas depende de T1, que depende del peso de la banda. Se repite hasta
  // que el número de telas se estabiliza (máx. 30 vueltas, converge en 2-3).
  let telas = PAR.banda.telasMin;
  let it = null;
  for (let vuelta = 0; vuelta < 30; vuelta++) {
    const masaBandaM2 = telas * tejido.masaKgM2 + (entrada.espesorSuperior + entrada.espesorInferior) * densidadGoma;
    const cargaBanda = Bm * masaBandaM2;
    const resistenciaCarga = coefC * entrada.f * entrada.L * g * (cargaRodillosCarga + (cargaBanda + cargaMaterial) * cosDelta)
      + (cargaBanda + cargaMaterial) * altura * g;
    const resistenciaRetorno = coefC * entrada.f * entrada.L * g * (cargaRodillosRetorno + cargaBanda * cosDelta)
      - cargaBanda * altura * g;
    const fuerzaTangencial = resistenciaCarga + resistenciaRetorno;

    const t2PorAdherencia = fuerzaTangencial / (factorAdherencia - 1);
    const t2PorFlechaCarga = (cargaBanda + cargaMaterial) * g * entrada.pasoCarga / (8 * flecha) - resistenciaRetorno;
    const t2PorFlechaRetorno = cargaBanda * g * entrada.pasoRetorno / (8 * flecha);
    const candidatos = [
      { valor: t2PorAdherencia, criterio: "adherencia en el tambor motriz (Euler-Eytelwein)" },
      { valor: t2PorFlechaCarga, criterio: "flecha máxima admisible en el ramal de carga" },
      { valor: t2PorFlechaRetorno, criterio: "flecha máxima admisible en el ramal de retorno" }
    ];
    const gobierna = candidatos.reduce((a, b) => (b.valor > a.valor ? b : a));
    const T2 = gobierna.valor;
    const T3 = T2 + resistenciaRetorno;
    const T1 = T2 + fuerzaTangencial;

    const resistenciaTelaNm = tejido.resistenciaKgfCm * g; // N por cm de ancho y tela
    const telasNecesarias = Math.ceil((T1 * entrada.coefSeguridad) / ((B / 10) * resistenciaTelaNm) - 1e-9);

    it = {
      telas, masaBandaM2, cargaBanda, resistenciaCarga, resistenciaRetorno, fuerzaTangencial,
      t2PorAdherencia, t2PorFlechaCarga, t2PorFlechaRetorno, gobierna, T1, T2, T3,
      telasNecesarias, resistenciaTelaNm, vuelta
    };
    const nuevasTelas = Math.max(PAR.banda.telasMin, telasNecesarias);
    if (nuevasTelas <= telas) break;
    telas = nuevasTelas;
  }
  const { cargaBanda, resistenciaCarga, resistenciaRetorno, fuerzaTangencial,
    T1, T2, T3, gobierna, telasNecesarias, resistenciaTelaNm } = it;

  anotar("Masa de la banda por metro", "q_B = B · (n · m_tela + (e_sup + e_inf) · ρ_goma)",
    `${Bm.toFixed(3)} · (${telas} · ${tejido.masaKgM2} + (${entrada.espesorSuperior} + ${entrada.espesorInferior}) · ${densidadGoma})`,
    `${cargaBanda.toFixed(2)} kg/m`, `Nº de telas final tras ${it.vuelta + 1} iteración(es): n = ${telas}.`);

  // ====================================================================
  // PASO 3 — RESISTENCIAS Y POTENCIA
  // ====================================================================
  anotar("Resistencia en el ramal de carga", "F_carga = C·f·L·g·[q_RO+(q_B+q_G)·cos δ] + (q_B+q_G)·H·g",
    "", `${resistenciaCarga.toFixed(0)} N`);
  anotar("Resistencia en el ramal de retorno", "F_ret = C·f·L·g·[q_RU+q_B·cos δ] − q_B·H·g",
    "", `${resistenciaRetorno.toFixed(0)} N`);
  anotar("Fuerza tangencial en el tambor motriz", "F_U = F_carga + F_ret",
    `${resistenciaCarga.toFixed(0)} + (${resistenciaRetorno.toFixed(0)})`, `${fuerzaTangencial.toFixed(0)} N`);

  if (!(fuerzaTangencial > 0)) {
    return { error: "La fuerza tangencial resulta nula o negativa: con estos datos la cinta no necesita accionamiento (caso de cinta descendente regenerativa, no contemplado)." };
  }

  const potenciaTambor = fuerzaTangencial * entrada.v;
  const potenciaMotor = potenciaTambor / entrada.rendimiento;
  const motorNormalizado = PAR.motoresNormalizadosKW.find(kW => kW * 1000 >= potenciaMotor - 1e-6) || null;
  anotar("Potencia en el tambor motriz", "P_A = F_U · v", `${fuerzaTangencial.toFixed(0)} · ${entrada.v}`, `${(potenciaTambor / 1000).toFixed(2)} kW`);
  anotar("Potencia necesaria del motor", "P_M = P_A / η", `${(potenciaTambor / 1000).toFixed(2)} / ${entrada.rendimiento}`,
    `${(potenciaMotor / 1000).toFixed(2)} kW`, motorNormalizado ? `Motor normalizado inmediato superior: ${motorNormalizado} kW.` : "Supera el catálogo de motores normalizados.");

  const diametroTamborM = entrada.diametroTambor / 1000;
  const parMotriz = fuerzaTangencial * diametroTamborM / 2;
  const giroTambor = 60 * entrada.v / (Math.PI * diametroTamborM);
  const relacionReductor = 1450 / giroTambor;
  anotar("Par y giro del tambor motriz", "M = F_U·D/2 ; n = 60·v / (π·D)",
    "", `M = ${parMotriz.toFixed(0)} N·m ; n = ${giroTambor.toFixed(1)} rpm`,
    `Con motor de 4 polos (≈1450 rpm), relación de reducción i ≈ ${relacionReductor.toFixed(1)}.`);

  // ====================================================================
  // PASO 4 — TENSIONES DE LA BANDA (Euler-Eytelwein + flecha)
  // ====================================================================
  anotar("Factor de Euler-Eytelwein", "e^(μ·θ)", `e^(${entrada.mu}·${(entrada.theta * GRADOS_A_RAD).toFixed(4)} rad)`, factorAdherencia.toFixed(3));
  anotar("Tensión del ramal flojo (T₂)", "T₂ = máx(adherencia, flecha carga, flecha retorno)",
    `gobierna: ${gobierna.criterio}`, `${T2.toFixed(0)} N`);
  anotar("Tensión del ramal tenso (T₁)", "T₁ = T₂ + F_U", `${T2.toFixed(0)} + ${fuerzaTangencial.toFixed(0)}`, `${T1.toFixed(0)} N`);
  anotar("Tensión en el tambor de cola (T₃ = T₄)", "T₃ = T₂ + F_ret", `${T2.toFixed(0)} + (${resistenciaRetorno.toFixed(0)})`, `${T3.toFixed(0)} N`);
  const relacionTensiones = T1 / T2;
  anotar("Comprobación de deslizamiento", "T₁ / T₂ ≤ e^(μθ)",
    `${T1.toFixed(0)} / ${T2.toFixed(0)} = ${relacionTensiones.toFixed(3)}`,
    relacionTensiones <= factorAdherencia + 1e-9 ? "CUMPLE (no desliza)" : "NO CUMPLE");

  // ====================================================================
  // PASO 5 — BANDA: Nº DE TELAS Y DESIGNACIÓN (UNE 18025)
  // ====================================================================
  const coefSeguridadReal = (B / 10) * resistenciaTelaNm * telas / T1;
  anotar("Nº de telas necesario", "n ≥ T₁ · CS / (B[cm] · R_tela · g)",
    `${telasNecesarias}`, `n = ${telas} telas ${tejido.codigo}`,
    `Calidad ${tejido.codigo}: ${tejido.resistenciaKgfCm} kgf/cm por tela. CS real obtenido = ${coefSeguridadReal.toFixed(2)}.`);

  const desarrolloBanda = 2 * entrada.L + Math.PI * diametroTamborM;
  const desarrolloRedondeado = Math.ceil(desarrolloBanda);
  anotar("Desarrollo (longitud) de la banda", "L_des = 2·L + π·D", `2·${entrada.L} + π·${diametroTamborM}`,
    `${desarrolloRedondeado} m`, "Tambores motriz y de cola del mismo diámetro; sin empalme ni recorrido del tensor.");

  const designacion = `${B} ${entrada.calidadRecubrimiento} – ${telas}${tejido.codigo}/${Math.round(entrada.espesorSuperior * 10)}-${Math.round(entrada.espesorInferior * 10)} des${desarrolloRedondeado} UNE 18025`;

  // ====================================================================
  // COMPROBACIONES Y RECOMENDACIONES (apuntes de la asignatura)
  // ====================================================================
  if (grado_llenado <= 1) advertir("ok", `Capacidad suficiente: grado de llenado ${(grado_llenado * 100).toFixed(1)} %.`);
  if (relacionTensiones <= factorAdherencia + 1e-9) advertir("ok", "No hay deslizamiento en el tambor motriz.");
  if (telas > PAR.banda.telasMax) advertir("aviso", `Se necesitan ${telas} telas (más de ${PAR.banda.telasMax}): conviene pasar a banda de cables de acero (St).`);
  const vMax = entrada.abrasividad ? PAR.velocidadMaxPorAbrasividad[entrada.abrasividad] : null;
  if (vMax && entrada.v > vMax) advertir("aviso", `Velocidad alta para abrasividad ${entrada.abrasividad}: se recomienda v ≤ ${vMax} m/s.`);
  if (entrada.inclinacion > 5) advertir("info", "Con δ > 5° se necesita una zona de carga horizontal bajo la tolva.");
  if (entrada.inclinacion > 18) advertir("aviso", "Inclinación cercana al límite de una banda lisa: valora una banda con perfiles.");
  if (entrada.pesoEspecifico > 2.0) advertir("info", "Material pesado: se aconsejan rodillos de impacto en la zona de carga.");
  if (entrada.pasoCarga < 1 || entrada.pasoCarga > 1.5) advertir("info", "El paso de rodillos de carga habitual está entre 1 y 1,5 m.");
  if (entrada.diametroRodillo < 100 || entrada.diametroRodillo > 150) advertir("info", "Diámetro de rodillo fuera del rango aconsejable de 100-150 mm.");
  if (entrada.terronMax && entrada.terronMax > B / 3) advertir("aviso", `Tamaño de terrón grande para este ancho: criterio orientativo a_max ≤ B/3 = ${(B / 3).toFixed(0)} mm.`);
  if (entrada.abrasividad === "C" && entrada.calidadRecubrimiento !== "A") advertir("aviso", "Material muy abrasivo: se recomienda recubrimiento de calidad A.");
  if (entrada.corrosividad === "C") advertir("info", "Material corrosivo: usar recubrimiento resistente a agentes químicos.");

  return {
    ok: true, entrada,
    caudalVolumetrico, factorK, caudalEquivalente, capacidadNecesaria, opcionesAncho,
    B, Bm, grado_llenado, caudalMaximo,
    altura, cargaMaterial, cargaRodillosCarga, cargaRodillosRetorno, coefC,
    cargaBanda, telas, telasNecesarias,
    resistenciaCarga, resistenciaRetorno, fuerzaTangencial,
    potenciaTambor, potenciaMotor, motorNormalizado, parMotriz, giroTambor, relacionReductor,
    factorAdherencia, T1, T2, T3, gobierna, relacionTensiones, coefSeguridadReal,
    desarrolloBanda, desarrolloRedondeado, designacion, tejido,
    memoria, avisos
  };
}

// Exponer para Node (pruebas) y para el navegador (script normal, sin módulos).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { dimensionarCinta, interpolarLineal, claseDeFluidez };
}
