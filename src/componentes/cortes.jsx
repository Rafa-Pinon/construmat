import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./cortes.css";

const CONCEPTOS_FRECUENTES = [
  "Diesel",
  "Tachis",
  "Centinela",
  "Desponchadora",
  "Refacciones",
  "Ayudante",
];

const CATEGORIAS = [
  "Combustible",
  "Mano de obra",
  "Refacciones",
  "Maquinaria",
  "Otros gastos",
];
function categoriaAutomatica(concepto) {
  const t = String(concepto || "").toLocaleLowerCase("es-MX");
  if (/diesel|diésel|gasolina|combustible|gas[oó]leo|pemex/.test(t))
    return "Combustible";
  if (/ayudante|auxiliar|pe[oó]n/.test(t)) return "Mano de obra";
  if (/tachis|centinela/.test(t)) return "Refacciones";
  if (
    /mano de obra|albañil|albanil|jornal|n[oó]mina|salario|sueldo|trabajador/.test(
      t,
    )
  )
    return "Mano de obra";
  if (
    /refacci[oó]n|repuesto|filtro|aceite|baler|reten|ret[eé]n|desponchadora|llanta/.test(
      t,
    )
  )
    return "Refacciones";
  if (
    /maquinaria|retroexcavadora|bobcat|excavadora|renta de m[aá]quina|motoniveladora/.test(
      t,
    )
  )
    return "Maquinaria";
  return "Otros gastos";
}
// Los gastos anteriores pueden tener una categoría automática incorrecta.
// Solo respetamos categorías elegidas explícitamente por el usuario.
function categoriaDeGasto(item) {
  // La elección manual tiene prioridad sobre cualquier palabra del concepto.
  // Así, "Refacciones" puede asignarse a "Otros gastos" o "Mano de obra".
  if (item.categoriaManual === true) {
    if (item.categoria === "Ayudantes") return "Mano de obra";
    if (CATEGORIAS.includes(item.categoria)) return item.categoria;
  }
  // Solo los movimientos sin clasificación manual se asignan automáticamente.
  return categoriaAutomatica(item.concept);
}

const estiloTarjetaBalance = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 20,
};

const CLAVES = ["myIncomes", "myExpenses", "partnerIncomes", "partnerExpenses"];
const VACIO = {
  myIncomes: [],
  myExpenses: [],
  partnerIncomes: [],
  partnerExpenses: [],
};
const formato = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    Number(n) || 0,
  );
const sumar = (lista) =>
  lista.reduce((total, item) => total + (Number(item.value) || 0), 0);
function cargarInicial() {
  const inicial = { ...VACIO };
  for (const clave of CLAVES) {
    try {
      const valor = JSON.parse(localStorage.getItem(clave) || "[]");
      inicial[clave] = Array.isArray(valor) ? valor : [];
    } catch {
      inicial[clave] = [];
    }
  }
  return inicial;
}

export default function Cortes() {
  const navigate = useNavigate();
  const [movimientos, setMovimientos] = useState(cargarInicial);
  const [formularios, setFormularios] = useState({
    yo: { concepto: "", importe: "" },
    papa: { concepto: "", importe: "" },
  });
  const [vista, setVista] = useState("ambos");
  const [vistaAnterior, setVistaAnterior] = useState("ambos");
  const [busqueda, setBusqueda] = useState("");
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [notasPagadas, setNotasPagadas] = useState([]);
  const [cargandoNotas, setCargandoNotas] = useState(false);
  const [errorNotas, setErrorNotas] = useState("");
  const [sugerencias, setSugerencias] = useState(null); // { socio, tipo, indice }

  // Solo consulta Firestore. No modifica ni las notas ni los pagos.
  useEffect(() => {
    let activo = true;
    async function cargarNotasPagadas() {
      setCargandoNotas(true);
      try {
        const resultado = await getDocs(
          query(collection(db, "notasCobro"), orderBy("numeroFolio", "desc")),
        );
        if (!activo) return;
        const pagadas = resultado.docs
          .map((documento) => ({ id: documento.id, ...documento.data() }))
          .filter((nota) => {
            const total = Number(nota.total) || 0;
            const pagado = (Array.isArray(nota.pagos) ? nota.pagos : []).reduce(
              (suma, pago) => suma + (Number(pago.monto) || 0),
              0,
            );
            return total > 0 && total - pagado < 0.005;
          })
          .map((nota) => ({
            id: nota.id,
            texto: `${nota.folio || "Sin folio"} - ${nota.customerName || "Sin cliente"}`,
            importe: Math.round((Number(nota.total) || 0) * 100) / 100,
          }));
        setNotasPagadas(pagadas);
        setErrorNotas("");
      } catch (err) {
        console.error("No se pudieron consultar las notas pagadas:", err);
        if (activo)
          setErrorNotas(
            "No se pudieron consultar las notas de Firebase. Revisa tu sesión y los permisos.",
          );
      } finally {
        if (activo) setCargandoNotas(false);
      }
    }
    cargarNotasPagadas();
    return () => {
      activo = false;
    };
  }, []);

  function elegirSugerencia(socio, opcion, tipo) {
    setFormularios((anterior) => ({
      ...anterior,
      [socio]: {
        ...anterior[socio],
        concepto: opcion.texto,
        ...(tipo === "notas" ? { importe: String(opcion.importe) } : {}),
      },
    }));
    setSugerencias(null);
    // Una nota pagada es un ingreso: solo falta presionar Enter para guardarlo.
    const selector =
      tipo === "notas"
        ? `[data-ingreso-socio="${socio}"]`
        : `[data-importe-socio="${socio}"]`;
    requestAnimationFrame(() => document.querySelector(selector)?.focus());
  }

  function opcionesSugeridas(tipo) {
    return tipo === "frecuentes"
      ? CONCEPTOS_FRECUENTES.map((texto) => ({ id: texto, texto }))
      : notasPagadas;
  }

  useEffect(() => {
    for (const clave of CLAVES)
      localStorage.setItem(clave, JSON.stringify(movimientos[clave]));
  }, [movimientos]);

  const totales = useMemo(() => {
    const yoIngresos = sumar(movimientos.myIncomes);
    const yoGastos = sumar(movimientos.myExpenses);
    const papaIngresos = sumar(movimientos.partnerIncomes);
    const papaGastos = sumar(movimientos.partnerExpenses);
    const yoNeto = yoIngresos - yoGastos;
    const papaNeto = papaIngresos - papaGastos;
    return {
      yoIngresos,
      yoGastos,
      papaIngresos,
      papaGastos,
      yoNeto,
      papaNeto,
      darPapa: yoNeto > papaNeto ? (yoNeto - papaNeto) / 2 : 0,
      cobrarPapa: papaNeto > yoNeto ? (papaNeto - yoNeto) / 2 : 0,
    };
  }, [movimientos]);

  function actualizarFormulario(socio, campo, valor) {
    setFormularios((anterior) => ({
      ...anterior,
      [socio]: { ...anterior[socio], [campo]: valor },
    }));
  }
  function agregar(socio, tipo) {
    const { concepto, importe } = formularios[socio];
    const numero = Number(importe);
    if (
      !concepto.trim() ||
      !importe.trim() ||
      !Number.isFinite(numero) ||
      numero <= 0
    ) {
      setError("Escribe un concepto y un importe válido mayor que cero.");
      setAviso("");
      return;
    }
    const clave =
      socio === "yo"
        ? tipo === "ingreso"
          ? "myIncomes"
          : "myExpenses"
        : tipo === "ingreso"
          ? "partnerIncomes"
          : "partnerExpenses";
    setMovimientos((anterior) => ({
      ...anterior,
      [clave]: [
        {
          concept: concepto.trim(),
          value: numero,
          fecha: new Date().toISOString(),
          ...(tipo === "gasto"
            ? { categoria: categoriaAutomatica(concepto) }
            : {}),
        },
        ...anterior[clave],
      ],
    }));
    setFormularios((anterior) => ({
      ...anterior,
      [socio]: { concepto: "", importe: "" },
    }));
    setSugerencias(null);
    setError("");
    setAviso(
      `${tipo === "ingreso" ? "Ingreso" : "Gasto"} registrado para ${socio === "yo" ? "ti" : "tu papá"}.`,
    );
  }
  function cambiarCategoria(clave, indice, categoria) {
    setMovimientos((anterior) => ({
      ...anterior,
      [clave]: anterior[clave].map((item, i) =>
        i === indice ? { ...item, categoria, categoriaManual: true } : item,
      ),
    }));
  }
  const balance = useMemo(() => {
    const ingresos = [...movimientos.myIncomes, ...movimientos.partnerIncomes];
    const gastos = [...movimientos.myExpenses, ...movimientos.partnerExpenses];
    const categorias = CATEGORIAS.map((nombre) => ({
      nombre,
      total: gastos.reduce(
        (acum, item) =>
          acum +
          (categoriaDeGasto(item) === nombre ? Number(item.value) || 0 : 0),
        0,
      ),
    }));
    const totalIngresos = sumar(ingresos);
    const totalGastos = sumar(gastos);
    return {
      categorias,
      totalIngresos,
      totalGastos,
      utilidad: totalIngresos - totalGastos,
      ingresosYo: sumar(movimientos.myIncomes),
      ingresosPapa: sumar(movimientos.partnerIncomes),
    };
  }, [movimientos]);
  function abrirBalance() {
    setVistaAnterior(vista === "balance" ? vistaAnterior : vista);
    setVista("balance");
    setSugerencias(null);
  }
  function pantallaBalance() {
    const maximo = Math.max(1, ...balance.categorias.map((c) => c.total));
    return (
      <section style={{ display: "grid", gap: 20, marginTop: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <span className="cc-eyebrow">ADMINISTRACIÓN / RESULTADOS</span>
            <h1>Estado de resultados</h1>
            <p>
              Resumen de ingresos y gastos registrados en Cortes, de ambos
              socios.
            </p>
            <button
              type="button"
              onClick={() => setVista(vistaAnterior)}
              style={{
                background: "none",
                border: 0,
                padding: "8px 0",
                color: "#2563eb",
                textDecoration: "underline",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              ← Volver a Cortes
            </button>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 14,
          }}
        >
          <div style={estiloTarjetaBalance}>
            <p>Ingresos totales</p>
            <h2 style={{ color: "#15803d" }}>
              {formato(balance.totalIngresos)}
            </h2>
          </div>
          <div style={estiloTarjetaBalance}>
            <p>Gastos totales</p>
            <h2 style={{ color: "#b91c1c" }}>{formato(balance.totalGastos)}</h2>
          </div>
          <div style={estiloTarjetaBalance}>
            <p>Utilidad después de gastos</p>
            <h2
              style={{ color: balance.utilidad >= 0 ? "#15803d" : "#b91c1c" }}
            >
              {formato(balance.utilidad)}
            </h2>
          </div>
        </div>
        <div style={estiloTarjetaBalance}>
          <h2>Ingresos por socio</h2>
          <p>
            Mis ingresos: <strong>{formato(balance.ingresosYo)}</strong>
          </p>
          <p>
            Ingresos de papá: <strong>{formato(balance.ingresosPapa)}</strong>
          </p>
        </div>
        <div style={estiloTarjetaBalance}>
          <h2>Gastos por concepto</h2>
          <p style={{ color: "#64748b" }}>
            Combustible aparece primero. Puedes corregir la categoría de
            cualquier gasto desde su registro en Cortes.
          </p>
          <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
            {balance.categorias.map((item) => (
              <div key={item.nombre}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 7,
                  }}
                >
                  <strong>{item.nombre}</strong>
                  <strong>{formato(item.total)}</strong>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 18,
                    background: "#e2e8f0",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div
                    role="img"
                    aria-label={`${item.nombre}: ${formato(item.total)}`}
                    style={{
                      width: `${(item.total / maximo) * 100}%`,
                      height: "100%",
                      background: "#2563eb",
                      borderRadius: 10,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 22, fontWeight: 700 }}>
            Total de gastos: {formato(balance.totalGastos)}
          </p>
        </div>
        <p style={{ color: "#64748b", fontSize: 13 }}>
          Los importes provienen únicamente de movimientos registrados en
          Cortes, guardados en este navegador. Las notas de Firebase no se suman
          por separado para evitar duplicaciones. La utilidad mostrada es
          ingresos menos gastos registrados; no sustituye un estado financiero
          contable o fiscal.
        </p>
      </section>
    );
  }
  function eliminar(clave, indice) {
    const movimiento = movimientos[clave][indice];
    if (
      !movimiento ||
      !window.confirm(
        `¿Eliminar "${movimiento.concept}" por ${formato(movimiento.value)}?`,
      )
    )
      return;
    setMovimientos((anterior) => ({
      ...anterior,
      [clave]: anterior[clave].filter((_, i) => i !== indice),
    }));
    setAviso("Movimiento eliminado.");
    setError("");
  }
  function limpiar() {
    if (
      !window.confirm(
        "¿Eliminar TODOS los ingresos y gastos de ambos socios? Esta acción no se puede deshacer.",
      )
    )
      return;
    setMovimientos({
      myIncomes: [],
      myExpenses: [],
      partnerIncomes: [],
      partnerExpenses: [],
    });
    setAviso("Se limpiaron los movimientos de ambos socios.");
    setError("");
  }

  function listaMovimientos(clave, titulo, tipo) {
    const lista = movimientos[clave];
    const filtrados = lista
      .map((item, indice) => ({ ...item, indice }))
      .filter((item) =>
        item.concept.toLowerCase().includes(busqueda.toLowerCase().trim()),
      );
    return (
      <div className="cc-lista" key={clave}>
        <div className="cc-lista-cabecera">
          <h3>{titulo}</h3>
          <strong className={tipo === "ingreso" ? "cc-verde" : "cc-rojo"}>
            {formato(sumar(lista))}
          </strong>
        </div>
        {filtrados.length === 0 ? (
          <p className="cc-vacio">
            {busqueda ? "Sin coincidencias" : "Todavía no hay movimientos"}
          </p>
        ) : (
          <div className="cc-movimientos">
            {filtrados.map((item) => (
              <div className="cc-movimiento" key={`${clave}-${item.indice}`}>
                <span className="cc-concepto">{item.concept}</span>
                <strong className={tipo === "ingreso" ? "cc-verde" : "cc-rojo"}>
                  {tipo === "gasto" ? "−" : "+"}
                  {formato(item.value)}
                </strong>
                {tipo === "gasto" && (
                  <label
                    style={{
                      display: "flex",
                      gap: 5,
                      alignItems: "center",
                      fontSize: 12,
                    }}
                  >
                    Categoría
                    <select
                      aria-label={`Categoría de ${item.concept}`}
                      value={categoriaDeGasto(item)}
                      onChange={(e) =>
                        cambiarCategoria(clave, item.indice, e.target.value)
                      }
                      style={{
                        maxWidth: 160,
                        padding: 6,
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                      }}
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className="cc-eliminar"
                  onClick={() => eliminar(clave, item.indice)}
                  aria-label={`Eliminar ${item.concept}`}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Navegación con flechas entre los formularios de ambos socios.
  function navegarConFlechas(evento) {
    const tecla = evento.key;
    const objetivo = evento.target;
    const socioConcepto = objetivo?.dataset?.conceptoSocio;

    if (
      socioConcepto &&
      ["ArrowUp", "ArrowDown"].includes(tecla) &&
      !evento.altKey &&
      !evento.ctrlKey &&
      !evento.metaKey &&
      !evento.shiftKey
    ) {
      evento.preventDefault();
      const tipo = tecla === "ArrowUp" ? "frecuentes" : "notas";
      setSugerencias((anterior) => {
        if (anterior?.socio === socioConcepto && anterior.tipo === tipo) {
          const cantidad = opcionesSugeridas(tipo).length;
          return {
            ...anterior,
            indice: cantidad ? (anterior.indice + 1) % cantidad : -1,
          };
        }
        return { socio: socioConcepto, tipo, indice: 0 };
      });
      return;
    }
    if (
      socioConcepto &&
      tecla === "Enter" &&
      sugerencias?.socio === socioConcepto
    ) {
      evento.preventDefault();
      const opciones = opcionesSugeridas(sugerencias.tipo);
      const seleccionada = opciones[sugerencias.indice];
      if (seleccionada)
        elegirSugerencia(socioConcepto, seleccionada, sugerencias.tipo);
      return;
    }
    if (tecla === "Escape" && sugerencias) {
      evento.preventDefault();
      setSugerencias(null);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(tecla))
      return;
    if (evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey)
      return;

    const controles = Array.from(
      evento.currentTarget.querySelectorAll(
        ".cc-formulario input, .cc-formulario button.cc-btn",
      ),
    ).filter((elemento) => !elemento.disabled);
    const indice = controles.indexOf(evento.target);
    if (indice === -1) return;

    // En el concepto, izquierda/derecha siguen moviendo el cursor mientras
    // haya texto a ese lado; en los extremos permiten cambiar de campo.
    if (
      evento.target instanceof HTMLInputElement &&
      evento.target.type === "text"
    ) {
      const inicio = evento.target.selectionStart;
      const fin = evento.target.selectionEnd;
      if (tecla === "ArrowLeft" && inicio > 0) return;
      if (tecla === "ArrowRight" && fin < evento.target.value.length) return;
    }

    evento.preventDefault();
    setSugerencias(null);
    const direccion = tecla === "ArrowDown" || tecla === "ArrowRight" ? 1 : -1;
    const siguiente =
      (indice + direccion + controles.length) % controles.length;
    controles[siguiente].focus();
  }

  function tarjetaSocio(socio) {
    const esYo = socio === "yo";
    const nombre = esYo ? "Mis movimientos" : "Movimientos de mi papá";
    const ingresos = esYo ? totales.yoIngresos : totales.papaIngresos;
    const gastos = esYo ? totales.yoGastos : totales.papaGastos;
    const neto = esYo ? totales.yoNeto : totales.papaNeto;
    const formulario = formularios[socio];
    return (
      <section className="cc-socio" key={socio}>
        <div className="cc-socio-titulo">
          <div className="cc-avatar">{esYo ? "YO" : "PAPÁ"}</div>
          <div>
            <h2>{nombre}</h2>
            <p>Registra ingresos y gastos de este socio</p>
          </div>
        </div>
        <div className="cc-metricas">
          <div>
            <span>Ingresos</span>
            <strong className="cc-verde">{formato(ingresos)}</strong>
          </div>
          <div>
            <span>Gastos</span>
            <strong className="cc-rojo">{formato(gastos)}</strong>
          </div>
          <div>
            <span>Saldo neto</span>
            <strong>{formato(neto)}</strong>
          </div>
        </div>
        <div className="cc-formulario">
          <label>
            Concepto
            <div style={{ position: "relative" }}>
              <input
                type="text"
                data-concepto-socio={socio}
                autoComplete="off"
                aria-label={`Concepto de ${esYo ? "mis movimientos" : "papá"}`}
                aria-expanded={sugerencias?.socio === socio}
                placeholder="Escribe libremente · ↑ frecuentes · ↓ notas pagadas"
                value={formulario.concepto}
                onChange={(e) => {
                  actualizarFormulario(socio, "concepto", e.target.value);
                  setSugerencias(null);
                }}
                onBlur={(e) => {
                  if (
                    !e.currentTarget.parentElement.contains(e.relatedTarget)
                  ) {
                    setSugerencias((actual) =>
                      actual?.socio === socio ? null : actual,
                    );
                  }
                }}
              />
              {sugerencias?.socio === socio && (
                <div
                  role="listbox"
                  aria-label="Sugerencias de concepto"
                  style={{
                    position: "absolute",
                    ...(sugerencias.tipo === "frecuentes"
                      ? { bottom: "100%", marginBottom: 4 }
                      : { top: "100%", marginTop: 4 }),
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    background: "#fff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    boxShadow: "0 12px 28px rgba(15,23,42,.18)",
                    maxHeight: 260,
                    overflowY: "auto",
                    padding: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      padding: "7px 9px",
                    }}
                  >
                    {sugerencias.tipo === "frecuentes"
                      ? "Conceptos frecuentes"
                      : "Notas completamente pagadas · Firebase"}
                  </div>
                  {sugerencias.tipo === "notas" && cargandoNotas && (
                    <p style={{ padding: 9 }}>Consultando notas...</p>
                  )}
                  {sugerencias.tipo === "notas" && errorNotas && (
                    <p style={{ padding: 9, color: "#b91c1c" }}>{errorNotas}</p>
                  )}
                  {!cargandoNotas &&
                    !errorNotas &&
                    opcionesSugeridas(sugerencias.tipo).length === 0 && (
                      <p style={{ padding: 9 }}>
                        No hay notas completamente pagadas.
                      </p>
                    )}
                  {opcionesSugeridas(sugerencias.tipo).map((opcion, indice) => (
                    <button
                      key={opcion.id}
                      type="button"
                      role="option"
                      aria-selected={indice === sugerencias.indice}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() =>
                        elegirSugerencia(socio, opcion, sugerencias.tipo)
                      }
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        border: 0,
                        borderRadius: 7,
                        padding: "10px 12px",
                        cursor: "pointer",
                        background:
                          indice === sugerencias.indice ? "#dbeafe" : "#fff",
                        color: "#172554",
                        fontSize: 14,
                      }}
                    >
                      {opcion.texto}
                      {sugerencias.tipo === "notas" && (
                        <strong
                          style={{
                            display: "block",
                            fontSize: 12,
                            color: "#15803d",
                            marginTop: 3,
                          }}
                        >
                          {formato(opcion.importe)}
                        </strong>
                      )}
                    </button>
                  ))}
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      padding: "7px 9px",
                    }}
                  >
                    Enter para elegir · Esc para cerrar
                  </div>
                </div>
              )}
            </div>
          </label>
          <label>
            Importe (MXN)
            <input
              type="number"
              data-importe-socio={socio}
              inputMode="decimal"
              min="0.01"
              step="any"
              placeholder="0.00"
              value={formulario.importe}
              onChange={(e) =>
                actualizarFormulario(socio, "importe", e.target.value)
              }
            />
          </label>
          <div className="cc-acciones">
            <button
              type="button"
              className="cc-btn cc-ingreso"
              data-ingreso-socio={socio}
              onClick={() => agregar(socio, "ingreso")}
            >
              + Agregar ingreso
            </button>
            <button
              type="button"
              className="cc-btn cc-gasto"
              onClick={() => agregar(socio, "gasto")}
            >
              − Agregar gasto
            </button>
          </div>
        </div>
        <div className="cc-dos-listas">
          {listaMovimientos(
            esYo ? "myIncomes" : "partnerIncomes",
            "Ingresos",
            "ingreso",
          )}
          {listaMovimientos(
            esYo ? "myExpenses" : "partnerExpenses",
            "Gastos",
            "gasto",
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="cc-pagina">
      <header className="cc-header">
        <div className="cc-header-interior">
          <button
            type="button"
            className="cc-volver"
            onClick={() => navigate("/")}
          >
            ← Volver al inicio
          </button>
          <div className="cc-marca">
            <strong>CONSTRUMAT</strong>
            <span>Construcciones y Materiales</span>
          </div>
        </div>
      </header>
      <main className="cc-main">
        {vista !== "balance" && (
          <div className="cc-encabezado">
            <div>
              <span className="cc-eyebrow">ADMINISTRACIÓN / SOCIOS</span>
              <h1>Cortes entre socios</h1>
              <p>
                Control de ingresos, gastos y reparto de saldos entre tú y tu
                papá.
              </p>
            </div>
          </div>
        )}
        {vista !== "balance" && (
          <div style={{ margin: "16px 0" }}>
            <button
              type="button"
              onClick={abrirBalance}
              style={{
                background: "#153d66",
                color: "white",
                border: 0,
                borderRadius: 10,
                padding: "12px 20px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📊 Estado de resultados
            </button>
          </div>
        )}
        {vista === "balance" ? (
          pantallaBalance()
        ) : (
          <>
            <section className="cc-resultado">
              <span className="cc-resultado-etiqueta">RESULTADO DEL CORTE</span>
              {totales.darPapa > 0 ? (
                <>
                  <h2>Debes entregar a tu papá</h2>
                  <strong>{formato(totales.darPapa)}</strong>
                  <p>Es la mitad de la diferencia entre ambos saldos netos.</p>
                </>
              ) : totales.cobrarPapa > 0 ? (
                <>
                  <h2>Tu papá debe entregarte</h2>
                  <strong>{formato(totales.cobrarPapa)}</strong>
                  <p>Es la mitad de la diferencia entre ambos saldos netos.</p>
                </>
              ) : (
                <>
                  <h2>Las cuentas están equilibradas</h2>
                  <strong>{formato(0)}</strong>
                  <p>Ningún socio debe entregar dinero al otro.</p>
                </>
              )}
            </section>
            <div className="cc-controles">
              <div className="cc-pestanas">
                <button
                  type="button"
                  className={vista === "ambos" ? "activo" : ""}
                  onClick={() => setVista("ambos")}
                >
                  Ambos socios
                </button>
                <button
                  type="button"
                  className={vista === "yo" ? "activo" : ""}
                  onClick={() => setVista("yo")}
                >
                  Mis cuentas
                </button>
                <button
                  type="button"
                  className={vista === "papa" ? "activo" : ""}
                  onClick={() => setVista("papa")}
                >
                  Cuentas de papá
                </button>
              </div>
              <label className="cc-buscar">
                Buscar movimiento
                <input
                  type="search"
                  placeholder="Buscar concepto..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </label>
            </div>
            {error && (
              <p className="cc-error" role="alert">
                {error}
              </p>
            )}
            {aviso && (
              <p className="cc-aviso" role="status">
                {aviso}
              </p>
            )}
            <div className="cc-socios" onKeyDown={navegarConFlechas}>
              {(vista === "ambos" || vista === "yo") && tarjetaSocio("yo")}
              {(vista === "ambos" || vista === "papa") && tarjetaSocio("papa")}
            </div>
            <div className="cc-pie">
              <p>
                Los movimientos se guardan en este navegador. No se sincronizan
                con otros dispositivos.
              </p>
              <button type="button" className="cc-limpiar" onClick={limpiar}>
                Eliminar todos los movimientos
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
