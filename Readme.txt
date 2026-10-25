=====================================================================
  DIMENSIONADO DE CINTAS TRANSPORTADORAS — APLICACIÓN WEB
  Transporte y Manutención Industrial · Máster en Ingeniería Industrial
  Escuela Técnica Superior de Ingeniería Industrial de Béjar · USAL
=====================================================================

1. OBJETIVO
-----------
Aplicación web que dimensiona una cinta transportadora de material a
granel a partir del material, el caudal, la velocidad, la longitud
entre ejes, la inclinación y el tipo de estación de rodillos.

Calcula:
  - El ancho de banda necesario, por tablas de capacidad volumétrica.
  - La capacidad máxima de la cinta elegida y el grado de llenado.
  - Las resistencias al avance y la fuerza tangencial en el tambor
    motriz (método del coeficiente C, DIN 22101).
  - La potencia en el tambor y la del motor, con motor normalizado.
  - El par y la velocidad de giro del tambor motriz.
  - Las tensiones de la banda (Euler-Eytelwein y flecha admisible
    entre rodillos).
  - El número de telas y la designación de la banda (UNE 18025).
  - Avisos y recomendaciones de los apuntes de la asignatura.

Cada vez que se cambia un dato se repite todo el cálculo y se
actualizan los resultados, los avisos y la memoria de cálculo paso a
paso (fórmula, sustitución numérica y resultado), para poder revisar
cualquier cifra a mano durante la defensa.


2. ARCHIVOS
-----------
  index.html           Estructura de la página: los cuatro bloques de
                        datos de entrada y el panel de resultados.
  css/styles.css        Aspecto visual: panel de instrumentos, con
                        franja de resultados principales arriba y
                        memoria de cálculo en formato de consola.
  js/calculo.js          MOTOR DE CÁLCULO. Función pura
                        dimensionarCinta(entrada, tablas) que no toca
                        la página: recibe los datos y los tres JSON y
                        devuelve los resultados, la memoria de cálculo
                        y los avisos. Se puede ejecutar aparte con
                        Node.js (ver test/verificar.js).
  js/dibujos.js          Dibuja los tres diagramas en SVG (no usa
                        <canvas> ni animación): sección cargada,
                        capacidad por ancho de banda disponible y
                        esquema de tensiones T1-T2-T3.
  js/app.js              Interfaz: lee los controles del formulario,
                        rellena los desplegables a partir de los JSON,
                        llama a dimensionarCinta() en cada cambio y
                        pinta resultados, avisos, memoria y diagramas.
                        No contiene ninguna fórmula de cálculo.
  data/materiales.json   125 materiales con su peso específico
                        aparente (mín-máx), ángulo de reposo,
                        abrasividad y corrosividad.
  data/capacidades.json  Capacidad volumétrica IVT (m3/h a v = 1 m/s)
                        según ancho de banda, ángulo de artesa y
                        ángulo de sobrecarga, para los cuatro tipos de
                        estación (plana, 2, 3 y 5 rodillos).
  data/parametros.json   Coeficientes auxiliares: factor K de
                        inclinación, factor K1 de alimentación,
                        coeficiente C (DIN 22101), coeficiente f,
                        rozamiento banda-tambor, ángulos de
                        abrazamiento, calidades de tejido y
                        recubrimiento (UNE 18025), diámetros de
                        rodillos y tambores, motores normalizados.
  test/verificar.js      Script de Node.js que ejecuta el motor de
                        cálculo con el ejemplo resuelto del apartado 6
                        y comprueba automáticamente que cada resultado
                        coincide con el valor esperado.
  Readme.txt             Este archivo.

Los datos están en JSON para poder ampliarlos o corregirlos sin
tocar el código: añadir un material nuevo en materiales.json hace que
aparezca automáticamente en la lista desplegable.


3. CÓMO EJECUTARLO
-------------------
Los JSON se leen con fetch(), así que la página debe abrirse desde un
servidor (abrir index.html con doble clic bloquea esa lectura).

Opción A — En local (con Python instalado):
  1. Descomprime el ZIP en una carpeta.
  2. Abre una consola en esa carpeta.
  3. Ejecuta:
        Windows:      py -m http.server 8000
        macOS/Linux:  python3 -m http.server 8000
  4. Abre en el navegador:  http://localhost:8000
  5. Para detener el servidor: Ctrl+C.

Opción B — En GitHub Pages (sin instalar nada):
  1. Sube todos los archivos a la raíz de un repositorio público.
  2. Settings > Pages > Source: "Deploy from a branch", rama "main",
     carpeta "/ (root)" > Save.
  3. En un minuto la aplicación estará en
        https://<usuario>.github.io/<repositorio>/

Verificación automática del motor de cálculo (opcional, con Node.js
instalado):
        cd test
        node verificar.js
  Compara el resultado de dimensionarCinta() con el ejemplo resuelto
  del apartado 6 y muestra "OK" o "MAL" para cada magnitud.


4. CÓMO SE USA
---------------
La columna izquierda tiene los datos, en cuatro bloques numerados.
La columna derecha muestra los resultados, actualizados al instante.

  [1] MATERIAL. Se busca escribiendo parte del nombre. Al elegirlo se
      muestran su peso específico, ángulo de reposo, fluidez,
      abrasividad y corrosividad. El peso específico se puede ajustar
      dentro del rango de la tabla (por defecto el mínimo, que es el
      caso más desfavorable para el ancho). Con «Material
      personalizado» se introducen las propiedades a mano. El ángulo
      de sobrecarga β se propone según la fluidez (tabla de los
      apuntes) pero se puede cambiar.
  [2] CONDICIONES DE TRANSPORTE. Caudal Q (t/h), velocidad v (m/s,
      con botones de velocidades normalizadas), longitud entre ejes L
      (m), inclinación δ (0-20°), regularidad de la alimentación y,
      opcional, tamaño máximo de terrón.
  [3] TIPO DE CINTA. Estación plana, de 2, 3 o 5 rodillos; ángulo de
      artesa; ancho automático (el menor que cumple) o impuesto; paso
      de rodillos en carga y en retorno; diámetro de rodillo y,
      opcional, la masa real de catálogo si se conoce.
  [4] BANDA Y ACCIONAMIENTO. Calidad de tejido, coeficiente de
      seguridad, calidad y espesores del recubrimiento, rozamiento
      banda-tambor, ángulo de abrazamiento, diámetro de tambor,
      rendimiento del accionamiento, coeficiente de rozamiento f y,
      opcional, un coeficiente C propio.

Resultados:
  - Franja superior con las cuatro cifras clave: ancho de banda,
    grado de llenado, potencia del motor normalizado y tensión
    máxima T1, más la designación completa de la banda.
  - Comprobaciones: lista de avisos (capacidad, deslizamiento,
    número de telas, velocidad máxima por abrasividad, inclinación,
    paso de rodillos, tamaño de terrón, abrasividad/corrosividad...).
  - Sección cargada: esquema de la estación elegida (número de
    rodillos, ángulo de artesa λ, ángulo de sobrecarga β y ancho B).
  - Capacidad por ancho de banda: barras con la capacidad máxima de
    cada ancho disponible en la tabla frente al caudal pedido (línea
    roja); la barra ámbar es el ancho elegido.
  - Esquema de tensiones: T1 (ramal cargado, hacia el tambor motriz),
    T2 (ramal de retorno) y T3 = T4 (tambor de cola), con la
    comprobación de deslizamiento T1/T2 ≤ e^(μθ).
  - Memoria de cálculo: cada paso con su fórmula, la sustitución
    numérica y el resultado, igual que se exige en los apuntes.

El botón «Cargar ejemplo del Readme» carga los datos del apartado 6.
El botón «Imprimir / guardar PDF» genera un informe con todo lo
anterior.


5. MÉTODO DE CÁLCULO
----------------------
Unidades: Q en t/h, v en m/s, longitudes en m, masas lineales en
kg/m, fuerzas en N, g = 9,81 m/s².

5.1 Ángulo de sobrecarga (tabla de fluidez de los apuntes)
    α ≤ 20°        fluidez muy buena   -> β = 5°
    20° < α ≤ 30°  fluidez buena       -> β = 10°
    30° < α ≤ 40°  fluidez normal      -> β = 20° (lado de la
                                          seguridad; el rango es 20-25°)
    α > 40°        fluidez mala        -> β = 30°
    Si la tabla no da α, se propone β = 20° y el usuario lo cambia.

5.2 Capacidad y ancho de banda (Rulmeca)
    Caudal volumétrico:            I_M  = Q / q_s            [m3/h]
    Factor de inclinación:         K    = f(δ)   (interpolado)
    Factor de alimentación:        K1   = 1 / 0,95 / 0,90 / 0,80
    Caudal equivalente horizontal: I_VM = I_M / (K · K1)      [m3/h]
    Capacidad necesaria a 1 m/s:   I_VT,nec = I_VM / v        [m3/h]
    Se elige el MENOR ancho B tal que I_VT(B) ≥ I_VT,nec, en la tabla
    que corresponda a la estación, con λ y β dados.
    Capacidad máxima:  Q_max = I_VT(B) · v · K · K1 · q_s     [t/h]
    Grado de llenado:  I_VT,nec / I_VT(B)

5.3 Cargas por metro
    Altura:            H    = L · sen δ
    Material:          q_G  = Q / (3,6 · v)                   [kg/m]
    Rodillos de carga: q_RO = m_RO / a_o
    Rodillos retorno:  q_RU = m_RU / a_u
      (si no se da m, se estima a partir del diámetro de rodillo)
    Banda:             q_B  = B · (n · m_tela + (e_sup+e_inf) · 1,15)

5.4 Resistencias y potencia (método del coeficiente C, DIN 22101)
    F_carga = C·f·L·g·[q_RO + (q_B+q_G)·cos δ] + (q_B+q_G)·H·g
    F_ret   = C·f·L·g·[q_RU + q_B·cos δ] − q_B·H·g
    F_U     = F_carga + F_ret
    P_A = F_U · v        P_M = P_A / η  -> motor normalizado superior
    M   = F_U · D/2       n = 60·v / (π·D)

5.5 Tensiones (Euler-Eytelwein y flecha, accionamiento en cabeza)
    a) No deslizamiento:  T2 ≥ F_U / (e^(μθ) − 1)
    b) Flecha en carga (h/a = 2%): T2 ≥ T0 − F_ret
    c) Flecha en retorno:          T2 ≥ T_r
    Se adopta T2 = máximo de a), b) y c); T1 = T2 + F_U;
    T3 = T4 = T2 + F_ret. Se comprueba de nuevo T1/T2 ≤ e^(μθ).

5.6 Banda (UNE 18025), cálculo iterativo
    n ≥ T1 · CS / (B[cm] · R_tela · g)
    Como q_B depende de n y T1 depende de q_B, se repite el cálculo
    (función dimensionarCinta, bucle de hasta 30 iteraciones; converge
    en 2-3) hasta que el número de telas no cambia.
    Desarrollo de banda: L_des = 2·L + π·D
    Designación: B Calidad–nTejido/e_sup-e_inf desL_des UNE 18025

5.7 Comprobaciones automáticas (avisos)
    Capacidad suficiente, adherencia en el tambor, más de 5° de
    inclinación (zona de carga horizontal), más de 18° (banda lisa al
    límite), peso específico > 2 t/m3 (rodillos de impacto), paso de
    rodillos fuera de rango, diámetro de rodillo fuera de rango,
    tamaño de terrón > B/3, material muy abrasivo o corrosivo, más de
    6 telas (pasar a banda de cables de acero).


6. EJEMPLO RESUELTO (verificación)
-------------------------------------
Enunciado: transportar 500 t/h de caliza fragmentada a 120 m de
distancia, con una pendiente ascendente de 8°, estación de 3 rodillos
en artesa a 30° y v = 2 m/s.

Datos (los que carga el botón «Cargar ejemplo»):
  Caliza fragmentada: q_s = 1,36 t/m3 (mínimo de la tabla), α = 35°
  -> fluidez normal -> β = 20°.
  Q = 500 t/h; v = 2 m/s; L = 120 m; δ = 8°; alimentación regular.
  3 rodillos, λ = 30°, Ø 133 mm; a_o = 1,2 m; a_u = 3,0 m; f = 0,020.
  Tambor revestido de goma seco: μ = 0,35; θ = 210°; Ø 500 mm;
  η = 0,90. Tejido L, CS = 10, recubrimiento B de 4 + 2 mm.

Resultado que debe dar la aplicación (y que confirma test/verificar.js):
  Ancho de banda:          B = 800 mm
  Capacidad máxima:        Q_max = 734,0 t/h
  Grado de llenado:        68,1 %
  Fuerza tangencial:       F_U = 15 572 N
  Potencia del motor:      34,60 kW -> motor normalizado de 37 kW
  Tensiones:               T1 = 22 368 N; T2 = 6 796 N; T3 = 5 810 N
  Comprobación:            T1/T2 = 3,291 ≤ e^(μθ) = 3,607 (no desliza)
  Banda:                   5 telas L; L_des = 242 m
  Designación:   800 B – 5L/40-20 des242 UNE 18025

Este ejemplo (enunciado y método) procede de los apuntes de la
asignatura; se ha usado como caso de control para verificar el motor
de cálculo, de forma independiente, con test/verificar.js.


7. HIPÓTESIS Y LIMITACIONES
-------------------------------
  - Cinta horizontal o ascendente (0°-20°, rango válido del factor K)
    con un único tambor motriz en cabeza. No se tratan cintas
    descendentes con frenado ni accionamientos intermedios.
  - Resistencias por el método del coeficiente C de DIN 22101, que
    incluye de forma global las resistencias secundarias (zona de
    carga, rascadores, tambores de desvío...). Se puede imponer un C
    propio si el enunciado lo da.
  - Masas de rodillos: valores orientativos por diámetro, editables
    en parametros.json o desde la propia página (masa por estación).
  - El desarrollo de banda no incluye el empalme ni el recorrido del
    tensor (conviene prever un margen, según los apuntes).
  - Herramienta de predimensionado con fines docentes: el diseño
    final debe contrastarse con el catálogo de un fabricante.
  - Las tablas de capacidad (Rulmeca) conservan algunos valores que
    no siguen la tendencia esperada (crecer con β, λ y el ancho); si
    el cálculo usa uno de ellos, se muestra un aviso explicándolo.


8. FUENTES
--------------
  - Apuntes de la asignatura "Transporte y Manutención Industrial"
    (Cintas transportadoras I y II), Universidad de Salamanca.
  - Rulmeca: "Informaciones técnicas y criterios de diseño de las
    cintas transportadoras": Tab. 2 (materiales), Tab. 5a-5d
    (capacidades volumétricas), Tab. 6 (factor K).
  - DIN 22101: Continuous conveyors. Belt conveyors for loose bulk
    materials. Basis for calculation and dimensioning.
  - UNE 18025: Bandas transportadoras compuestas de goma y tejido.
