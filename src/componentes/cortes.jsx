import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./cortes.css";

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
  const [busqueda, setBusqueda] = useState("");
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");

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
        { concept: concepto.trim(), value: numero },
        ...anterior[clave],
      ],
    }));
    setFormularios((anterior) => ({
      ...anterior,
      [socio]: { concepto: "", importe: "" },
    }));
    setError("");
    setAviso(
      `${tipo === "ingreso" ? "Ingreso" : "Gasto"} registrado para ${socio === "yo" ? "ti" : "tu papá"}.`,
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
            <input
              type="text"
              placeholder="Ej. Pago de acarreo, combustible..."
              value={formulario.concepto}
              onChange={(e) =>
                actualizarFormulario(socio, "concepto", e.target.value)
              }
            />
          </label>
          <label>
            Importe (MXN)
            <input
              type="number"
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
        <div className="cc-socios">
          {(vista === "ambos" || vista === "yo") && tarjetaSocio("yo")}
          {(vista === "ambos" || vista === "papa") && tarjetaSocio("papa")}
        </div>
        <div className="cc-pie">
          <p>
            Los movimientos se guardan en este navegador. No se sincronizan con
            otros dispositivos.
          </p>
          <button type="button" className="cc-limpiar" onClick={limpiar}>
            Eliminar todos los movimientos
          </button>
        </div>
      </main>
    </div>
  );
}
