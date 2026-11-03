import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Logo from "../logo/logo.png";

const UNIDADES_INICIALES = [
  "m3",
  "Proyecto",
  "Metro lineal",
  "Viajes",
  "Hrs máquina",
  "Día",
  "Servicio",
  "Camión",
];

const CLAVE_UNIDADES = "construmat_unidades_medida";

function obtenerUnidades() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE_UNIDADES) || "[]");

    if (!Array.isArray(guardadas)) {
      return [...UNIDADES_INICIALES];
    }

    return [
      ...UNIDADES_INICIALES,
      ...guardadas.filter(
        (unidad) =>
          typeof unidad === "string" &&
          unidad.trim() &&
          !UNIDADES_INICIALES.some(
            (inicial) => inicial.toLowerCase() === unidad.toLowerCase(),
          ),
      ),
    ];
  } catch {
    return [...UNIDADES_INICIALES];
  }
}

function crearConcepto() {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    description: "",
    unit: "",
    quantity: "1",
    price: "",
  };
}

function fechaLocal() {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function moneda(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(valor) || 0);
}

function fechaTexto(valor) {
  if (!valor) return "Sin fecha";
  const [anio, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${anio}`;
}

function calcularTotal(items) {
  return items.reduce(
    (suma, item) =>
      suma + (Number(item.quantity) || 0) * (Number(item.price) || 0),
    0,
  );
}

function pagosDeNota(nota) {
  return Array.isArray(nota?.pagos) ? nota.pagos : [];
}

function resumenPagos(nota) {
  const total = Math.max(0, Number(nota?.total) || 0);
  const pagado = pagosDeNota(nota).reduce(
    (suma, pago) => suma + (Number(pago.monto) || 0),
    0,
  );
  const saldo = Math.max(0, Math.round((total - pagado) * 100) / 100);
  return {
    pagado,
    saldo,
    estado: saldo < 0.005 ? "Pagada" : pagado > 0 ? "Abonada" : "Pendiente",
  };
}

function datosIniciales() {
  return {
    customerName: "",
    customerTrabajo: "",
    date: fechaLocal(),
    folio: "",
    observations: "",
    items: [crearConcepto()],
  };
}

export default function Factura() {
  const navigate = useNavigate();

  const [datos, setDatos] = useState(datosIniciales);
  const [unidades, setUnidades] = useState(obtenerUnidades);
  const [notaId, setNotaId] = useState(null);
  const [notaActual, setNotaActual] = useState(null);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("Transferencia");
  const [fechaPago, setFechaPago] = useState(fechaLocal());
  const [referenciaPago, setReferenciaPago] = useState("");
  const [registrandoPago, setRegistrandoPago] = useState(false);
  const [notas, setNotas] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [vistaCobros, setVistaCobros] = useState("todas");
  const [filtroMetodo, setFiltroMetodo] = useState("Todos");
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [notaEliminar, setNotaEliminar] = useState(null);
  const [claveEliminar, setClaveEliminar] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const total = useMemo(() => calcularTotal(datos.items), [datos.items]);

  const cartera = useMemo(
    () =>
      notas.reduce(
        (resumen, nota) => {
          const datosPago = resumenPagos(nota);
          resumen.pendiente += datosPago.saldo;
          resumen.cobrado += datosPago.pagado;
          if (datosPago.saldo > 0.005) resumen.notasPendientes += 1;
          return resumen;
        },
        { pendiente: 0, cobrado: 0, notasPendientes: 0 },
      ),
    [notas],
  );

  const pagoActual = resumenPagos(notaActual);

  // Los ingresos se calculan con movimientos reales, no con el total de la nota.
  // Esto permite contar correctamente los abonos y las notas pagadas con varios métodos.
  const resumenCobros = useMemo(() => {
    const ingresos = { Transferencia: 0, Efectivo: 0, Cheque: 0, Otro: 0 };
    let totalPagadas = 0;
    let cantidadPagadas = 0;
    let cantidadPendientes = 0;
    notas.forEach((nota) => {
      const estado = resumenPagos(nota);
      if (estado.estado === "Pagada") {
        totalPagadas += Number(nota.total) || 0;
        cantidadPagadas++;
      } else {
        cantidadPendientes++;
      }
      pagosDeNota(nota).forEach((pago) => {
        const metodo = String(pago.metodo || "")
          .trim()
          .toLowerCase();
        const clave =
          metodo === "transferencia"
            ? "Transferencia"
            : metodo === "efectivo"
              ? "Efectivo"
              : metodo === "cheque"
                ? "Cheque"
                : "Otro";
        ingresos[clave] += Number(pago.monto) || 0;
      });
    });
    return { ingresos, totalPagadas, cantidadPagadas, cantidadPendientes };
  }, [notas]);

  const notasFiltradas = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();
    return notas.filter((nota) => {
      const estado = resumenPagos(nota);
      if (vistaCobros === "pagadas" && estado.estado !== "Pagada") return false;
      if (vistaCobros === "pendientes" && estado.estado === "Pagada")
        return false;
      if (
        filtroMetodo !== "Todos" &&
        !pagosDeNota(nota).some(
          (pago) =>
            String(pago.metodo || "").toLowerCase() ===
            filtroMetodo.toLowerCase(),
        )
      )
        return false;
      return [nota.folio, nota.customerName, nota.customerTrabajo]
        .join(" ")
        .toLowerCase()
        .includes(texto);
    });
  }, [notas, busqueda, vistaCobros, filtroMetodo]);

  const totalVista = useMemo(
    () =>
      notasFiltradas.reduce(
        (suma, nota) =>
          suma +
          (vistaCobros === "pendientes"
            ? resumenPagos(nota).saldo
            : vistaCobros === "pagadas"
              ? Number(nota.total) || 0
              : resumenPagos(nota).pagado),
        0,
      ),
    [notasFiltradas, vistaCobros],
  );

  const totalMetodoFiltrado = useMemo(
    () =>
      notasFiltradas.reduce(
        (suma, nota) =>
          suma +
          pagosDeNota(nota).reduce(
            (sub, pago) =>
              sub +
              (filtroMetodo === "Todos" ||
              String(pago.metodo || "").toLowerCase() ===
                filtroMetodo.toLowerCase()
                ? Number(pago.monto) || 0
                : 0),
            0,
          ),
        0,
      ),
    [notasFiltradas, filtroMetodo],
  );

  async function cargarNotas() {
    setCargando(true);

    try {
      const consulta = query(
        collection(db, "notasCobro"),
        orderBy("numeroFolio", "desc"),
      );

      const resultado = await getDocs(consulta);

      const lista = resultado.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));
      setNotas(lista);
      setNotaActual((anterior) =>
        anterior
          ? lista.find((nota) => nota.id === anterior.id) || anterior
          : null,
      );
    } catch (err) {
      console.error(err);
      setError(
        "No se pudo cargar el historial. Revisa las reglas de Firebase.",
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarNotas();
  }, []);

  function actualizarDato(campo, valor) {
    setDatos((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  function actualizarConcepto(id, campo, valor) {
    setDatos((anterior) => ({
      ...anterior,
      items: anterior.items.map((item) =>
        item.id === id ? { ...item, [campo]: valor } : item,
      ),
    }));
  }

  function seleccionarUnidad(id, valor) {
    if (valor === "__otra__") {
      const respuesta = window.prompt("Escribe la nueva unidad de medida:", "");

      if (respuesta === null) return;

      const nombre = respuesta.trim();

      if (!nombre || nombre.length > 60) {
        window.alert("Escribe una unidad válida de máximo 60 caracteres.");
        return;
      }

      const existente = unidades.find(
        (unidad) => unidad.toLowerCase() === nombre.toLowerCase(),
      );

      const unidadFinal = existente || nombre;

      if (!existente) {
        const nuevas = [...unidades, nombre];
        setUnidades(nuevas);

        try {
          localStorage.setItem(
            CLAVE_UNIDADES,
            JSON.stringify(
              nuevas.filter(
                (unidad) =>
                  !UNIDADES_INICIALES.some(
                    (inicial) => inicial.toLowerCase() === unidad.toLowerCase(),
                  ),
              ),
            ),
          );
        } catch (err) {
          console.warn(err);
        }
      }

      actualizarConcepto(id, "unit", unidadFinal);
      return;
    }

    actualizarConcepto(id, "unit", valor);
  }

  function agregarConcepto() {
    setDatos((anterior) => ({
      ...anterior,
      items: [...anterior.items, crearConcepto()],
    }));
  }

  function eliminarConcepto(id) {
    setDatos((anterior) => ({
      ...anterior,
      items:
        anterior.items.length > 1
          ? anterior.items.filter((item) => item.id !== id)
          : [crearConcepto()],
    }));
  }

  function nuevaNota() {
    if (
      !window.confirm(
        "¿Crear una nueva nota? Los cambios sin guardar se perderán.",
      )
    ) {
      return;
    }

    setDatos(datosIniciales());
    setNotaId(null);
    setNotaActual(null);
    setMontoPago("");
    setMensaje("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function abrirNota(nota) {
    if (
      !window.confirm(
        `¿Abrir la nota ${nota.folio}? Los cambios sin guardar se perderán.`,
      )
    ) {
      return;
    }

    setDatos({
      customerName: nota.customerName || "",
      customerTrabajo: nota.customerTrabajo || "",
      date: nota.date || fechaLocal(),
      folio: nota.folio || "",
      observations: nota.observations || "",
      items:
        Array.isArray(nota.items) && nota.items.length
          ? nota.items.map((item) => ({
              ...crearConcepto(),
              ...item,
            }))
          : [crearConcepto()],
    });

    setNotaId(nota.id);
    setNotaActual(nota);
    setMontoPago("");
    setFechaPago(fechaLocal());
    setReferenciaPago("");
    setMensaje(`Editando la nota ${nota.folio}`);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validarNota() {
    if (!datos.customerName.trim()) {
      setError("Escribe el nombre del cliente.");
      return false;
    }

    if (!datos.date) {
      setError("Selecciona la fecha.");
      return false;
    }

    if (
      !datos.items.length ||
      datos.items.some(
        (item) =>
          !item.description.trim() ||
          !item.unit ||
          !Number.isFinite(Number(item.quantity)) ||
          Number(item.quantity) <= 0 ||
          !Number.isFinite(Number(item.price)) ||
          Number(item.price) < 0 ||
          item.price === "",
      )
    ) {
      setError(
        "Revisa los conceptos: todos necesitan descripción, unidad, cantidad mayor que cero y precio válido.",
      );
      return false;
    }

    setError("");
    return true;
  }

  async function guardarNota() {
    if (guardando || !validarNota()) return;

    if (!auth.currentUser) {
      setError("Tu sesión terminó. Inicia sesión nuevamente.");
      return;
    }

    setGuardando(true);
    setMensaje("");

    const contenido = {
      customerName: datos.customerName.trim(),
      customerTrabajo: datos.customerTrabajo.trim(),
      date: datos.date,
      observations: datos.observations,
      items: datos.items.map((item) => ({
        id: item.id,
        description: item.description.trim(),
        unit: item.unit,
        quantity: item.quantity,
        price: item.price,
      })),
      total: calcularTotal(datos.items),
    };

    try {
      if (notaId) {
        // EDITAR: conservar el folio original.
        await runTransaction(db, async (transaccion) => {
          const referencia = doc(db, "notasCobro", notaId);
          const actual = await transaccion.get(referencia);
          if (!actual.exists()) throw new Error("La nota ya no existe.");
          const pagos = pagosDeNota(actual.data());
          const yaPagado = pagos.reduce(
            (suma, pago) => suma + (Number(pago.monto) || 0),
            0,
          );
          if (contenido.total + 0.005 < yaPagado) {
            throw new Error(
              "El nuevo total no puede ser menor a los pagos registrados.",
            );
          }
          transaccion.update(referencia, {
            ...contenido,
            actualizadoEn: serverTimestamp(),
          });
        });

        setMensaje(`La nota ${datos.folio} se actualizó correctamente.`);
      } else {
        // CREAR: asignar folio y guardar nota
        // en una única transacción.
        const referenciaContador = doc(db, "configuracion", "foliosNotasCobro");

        const referenciaNota = doc(collection(db, "notasCobro"));

        const resultado = await runTransaction(db, async (transaccion) => {
          const contador = await transaccion.get(referenciaContador);

          const numeroAnterior = contador.exists()
            ? Number(contador.data().ultimoNumero) || 0
            : 0;

          const siguienteNumero = numeroAnterior + 1;

          const folio = `NC-${String(siguienteNumero).padStart(4, "0")}`;

          transaccion.set(referenciaContador, {
            ultimoNumero: siguienteNumero,
            actualizadoEn: serverTimestamp(),
          });

          transaccion.set(referenciaNota, {
            ...contenido,
            numeroFolio: siguienteNumero,
            folio,
            pagos: [],
            creadoPor: auth.currentUser.uid,
            creadoEn: serverTimestamp(),
            actualizadoEn: serverTimestamp(),
          });

          return {
            id: referenciaNota.id,
            folio,
          };
        });

        setNotaId(resultado.id);
        setNotaActual({
          id: resultado.id,
          ...contenido,
          folio: resultado.folio,
          pagos: [],
        });

        setDatos((anterior) => ({
          ...anterior,
          folio: resultado.folio,
        }));

        setMensaje(
          `Nota ${resultado.folio} guardada correctamente en Firebase.`,
        );
      }

      setVistaCobros("todas");
      setFiltroMetodo("Todos");
      setBusqueda("");

      await cargarNotas();
    } catch (err) {
      console.error("Error guardando nota:", err);
      setError(
        err.message?.startsWith("El nuevo total") ||
          err.message === "La nota ya no existe."
          ? err.message
          : `No se pudo guardar la nota. ${
              err.code === "permission-denied"
                ? "Verifica que el UID de las reglas coincida con tu usuario."
                : "Revisa tu conexión y vuelve a intentar."
            }`,
      );
    } finally {
      setGuardando(false);
    }
  }

  async function registrarPago(pagoCompleto = false) {
    if (!notaId || !notaActual || registrandoPago || guardando) return;
    if (Math.abs(total - (Number(notaActual.total) || 0)) > 0.005) {
      setError(
        "Guarda primero los cambios de la nota antes de registrar un pago.",
      );
      return;
    }
    if (!auth.currentUser) {
      setError("Tu sesión terminó. Inicia sesión nuevamente.");
      return;
    }
    const monto = pagoCompleto ? pagoActual.saldo : Number(montoPago);
    if (
      !Number.isFinite(monto) ||
      monto <= 0 ||
      Math.round(monto * 100) !== monto * 100
    ) {
      setError(
        "Escribe un importe válido, mayor a cero y con máximo dos decimales.",
      );
      return;
    }
    if (!fechaPago) {
      setError("Selecciona la fecha del pago.");
      return;
    }
    if (
      !window.confirm(
        `¿Registrar un pago de ${moneda(monto)} para la nota ${datos.folio}?`,
      )
    )
      return;

    setRegistrandoPago(true);
    setError("");
    setMensaje("");
    try {
      const referencia = doc(db, "notasCobro", notaId);
      await runTransaction(db, async (transaccion) => {
        const documento = await transaccion.get(referencia);
        if (!documento.exists()) throw new Error("La nota ya no existe.");
        const nota = documento.data();
        const pagos = pagosDeNota(nota);
        const resumen = resumenPagos(nota);
        if (monto > resumen.saldo + 0.005) {
          throw new Error(
            `El pago supera el saldo disponible de ${moneda(resumen.saldo)}. Actualiza la nota e inténtalo de nuevo.`,
          );
        }
        const pago = {
          id: doc(collection(db, "notasCobro")).id,
          monto: Math.round(monto * 100) / 100,
          fecha: fechaPago,
          metodo: metodoPago,
          referencia: referenciaPago.trim(),
          registradoEn: new Date().toISOString(),
          registradoPor: auth.currentUser.uid,
        };
        transaccion.update(referencia, {
          pagos: [...pagos, pago],
          actualizadoEn: serverTimestamp(),
        });
      });
      setMontoPago("");
      setReferenciaPago("");
      setMensaje(
        `Pago de ${moneda(monto)} registrado correctamente en ${datos.folio}.`,
      );
      await cargarNotas();
    } catch (err) {
      console.error("Error registrando pago:", err);
      setError(err.message || "No se pudo registrar el pago.");
    } finally {
      setRegistrandoPago(false);
    }
  }

  async function eliminarNotaDefinitivamente(evento) {
    evento.preventDefault();
    if (!notaEliminar || eliminando) return;
    const usuario = auth.currentUser;
    if (!usuario?.email) {
      setError(
        "Necesitas iniciar sesión con correo y contraseña para eliminar notas.",
      );
      return;
    }
    if (!claveEliminar) {
      setError("Escribe tu contraseña para confirmar.");
      return;
    }
    setEliminando(true);
    setError("");
    setMensaje("");
    try {
      const credencial = EmailAuthProvider.credential(
        usuario.email,
        claveEliminar,
      );
      await reauthenticateWithCredential(usuario, credencial);
      await deleteDoc(doc(db, "notasCobro", notaEliminar.id));
      const folioEliminado = notaEliminar.folio;
      if (notaId === notaEliminar.id) {
        setDatos(datosIniciales());
        setNotaId(null);
        setNotaActual(null);
        setMontoPago("");
        setReferenciaPago("");
      }
      setNotaEliminar(null);
      setClaveEliminar("");
      await cargarNotas();
      setMensaje(`La nota ${folioEliminado} fue eliminada definitivamente.`);
    } catch (err) {
      console.error("Error al eliminar nota:", err);
      const texto =
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password"
          ? "Contraseña incorrecta. Inténtalo de nuevo."
          : err.code === "auth/too-many-requests"
            ? "Demasiados intentos. Espera unos minutos."
            : err.code === "permission-denied"
              ? "Firebase no permite eliminar esta nota. Revisa las reglas de Firestore."
              : err.code === "auth/requires-recent-login"
                ? "Inicia sesión nuevamente y vuelve a intentarlo."
                : "No se pudo eliminar la nota. Revisa tu conexión y vuelve a intentarlo.";
      setError(texto);
    } finally {
      setEliminando(false);
    }
  }

  async function generarPDF() {
    if (!datos.customerName.trim()) {
      setError("Escribe el nombre del cliente.");
      return;
    }

    setError("");
    setGenerando(true);

    try {
      const elemento = document.getElementById("cm-nota-documento");

      if (!elemento) {
        throw new Error("No se encontró la nota.");
      }

      const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: Math.max(elemento.scrollWidth, 800),
      });

      const imagen = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const anchoPagina = pdf.internal.pageSize.getWidth();
      const altoPagina = pdf.internal.pageSize.getHeight();
      const margen = 10;
      const anchoImagen = anchoPagina - margen * 2;
      const altoImagen = (canvas.height * anchoImagen) / canvas.width;
      const altoUtil = altoPagina - margen * 2;

      let desplazamiento = 0;

      while (desplazamiento < altoImagen) {
        if (desplazamiento > 0) pdf.addPage();

        pdf.addImage(
          imagen,
          "PNG",
          margen,
          margen - desplazamiento,
          anchoImagen,
          altoImagen,
        );

        desplazamiento += altoUtil;
      }

      const nombre = datos.customerName
        .trim()
        .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ -]/g, "")
        .replace(/\s+/g, "_");

      pdf.save(`${datos.folio || "Nota_Sin_Guardar"}_${nombre}.pdf`);

      setMensaje("PDF descargado correctamente.");
    } catch (err) {
      console.error(err);
      setError("No se pudo generar el PDF.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="cm-factura">
      <header className="cm-factura-header">
        <div className="cm-factura-header-inner">
          <button
            type="button"
            className="cm-factura-back"
            onClick={() => navigate("/")}
          >
            ← Volver al inicio
          </button>

          <div className="cm-factura-header-brand">
            <img src={Logo} alt="Construmat" />
            <div>
              <strong>CONSTRUMAT</strong>
              <span>Construcciones y Materiales</span>
            </div>
          </div>
        </div>
      </header>

      <main className="cm-factura-main">
        <div className="cm-factura-heading">
          <div>
            <span className="cm-factura-eyebrow">
              ADMINISTRACIÓN / DOCUMENTOS
            </span>
            <h1>Notas de cobro</h1>
            <p>
              Crea, guarda y consulta tus notas con folios consecutivos
              automáticos.
            </p>
          </div>

          <button
            type="button"
            className="cm-factura-clear"
            onClick={nuevaNota}
          >
            + Nueva nota
          </button>
        </div>

        <div className="cm-factura-layout">
          <section className="cm-factura-editor">
            <div className="cm-factura-panel">
              <div className="cm-factura-panel-heading">
                <div className="cm-factura-step">01</div>
                <div>
                  <h2>Información general</h2>
                  <p>Datos del cliente y trabajo realizado.</p>
                </div>
              </div>

              <div className="cm-factura-fields">
                <div className="cm-factura-field cm-factura-full">
                  <label>Nombre del cliente</label>
                  <input
                    type="text"
                    placeholder="Nombre o razón social"
                    value={datos.customerName}
                    onChange={(e) =>
                      actualizarDato("customerName", e.target.value)
                    }
                  />
                </div>

                <div className="cm-factura-field cm-factura-full">
                  <label>Nombre del trabajo</label>
                  <input
                    type="text"
                    placeholder="Ej. Acarreo de material"
                    value={datos.customerTrabajo}
                    onChange={(e) =>
                      actualizarDato("customerTrabajo", e.target.value)
                    }
                  />
                </div>

                <div className="cm-factura-field">
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={datos.date}
                    onChange={(e) => actualizarDato("date", e.target.value)}
                  />
                </div>

                <div className="cm-factura-field">
                  <label>Folio automático</label>
                  <input
                    type="text"
                    value={datos.folio || "Se asignará al guardar"}
                    readOnly
                    style={{
                      background: "#f1f5f9",
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="cm-factura-panel">
              <div className="cm-factura-panel-heading">
                <div className="cm-factura-step">02</div>
                <div>
                  <h2>Conceptos de cobro</h2>
                  <p>Materiales, maquinaria y servicios.</p>
                </div>
              </div>

              <div className="cm-factura-items">
                {datos.items.map((item, index) => (
                  <div className="cm-factura-item" key={item.id}>
                    <div className="cm-factura-item-heading">
                      <strong>Concepto {index + 1}</strong>
                      <button
                        type="button"
                        className="cm-factura-remove"
                        onClick={() => eliminarConcepto(item.id)}
                      >
                        Eliminar
                      </button>
                    </div>

                    <div className="cm-factura-fields">
                      <div className="cm-factura-field cm-factura-full">
                        <label>Descripción</label>
                        <textarea
                          rows="2"
                          placeholder="Describe el trabajo o material..."
                          value={item.description}
                          onChange={(e) =>
                            actualizarConcepto(
                              item.id,
                              "description",
                              e.target.value,
                            )
                          }
                        />
                      </div>

                      <div className="cm-factura-field">
                        <label>Unidad de medida</label>
                        <select
                          value={item.unit}
                          onChange={(e) =>
                            seleccionarUnidad(item.id, e.target.value)
                          }
                          style={{
                            width: "100%",
                            minHeight: "47px",
                            padding: "12px 14px",
                            border: "1px solid #dce3eb",
                            borderRadius: "9px",
                            background: "#fff",
                            color: "#1b2939",
                            fontSize: "13px",
                          }}
                        >
                          <option value="">Seleccionar unidad</option>
                          {unidades.map((unidad) => (
                            <option key={unidad} value={unidad}>
                              {unidad}
                            </option>
                          ))}
                          <option value="__otra__">
                            + Otro / Agregar nueva unidad
                          </option>
                        </select>
                      </div>

                      <div className="cm-factura-field">
                        <label>Cantidad</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.quantity}
                          onChange={(e) =>
                            actualizarConcepto(
                              item.id,
                              "quantity",
                              e.target.value,
                            )
                          }
                        />
                      </div>

                      <div className="cm-factura-field">
                        <label>Precio unitario (MXN)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0.00"
                          value={item.price}
                          onChange={(e) =>
                            actualizarConcepto(item.id, "price", e.target.value)
                          }
                        />
                      </div>

                      <div className="cm-factura-item-subtotal">
                        <span>Importe</span>
                        <strong>
                          {moneda(
                            (Number(item.quantity) || 0) *
                              (Number(item.price) || 0),
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="cm-factura-add"
                onClick={agregarConcepto}
              >
                + Agregar otro concepto
              </button>
            </div>

            <div className="cm-factura-panel">
              <div className="cm-factura-panel-heading">
                <div className="cm-factura-step">03</div>
                <div>
                  <h2>Observaciones</h2>
                  <p>Información adicional para el cliente.</p>
                </div>
              </div>

              <div className="cm-factura-field">
                <label>Notas adicionales (opcional)</label>
                <textarea
                  rows="3"
                  placeholder="Condiciones de pago o detalles del servicio."
                  value={datos.observations}
                  onChange={(e) =>
                    actualizarDato("observations", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="cm-factura-panel" style={{ marginTop: 20 }}>
              <div className="cm-factura-panel-heading">
                <div className="cm-factura-step">04</div>
                <div>
                  <h2>Pagos y abonos</h2>
                  <p>Registra el dinero recibido después de guardar la nota.</p>
                </div>
              </div>
              {!notaId ? (
                <p>
                  Guarda la nota para habilitar el registro de pagos. Quedará
                  pendiente hasta que el cliente pague.
                </p>
              ) : (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: 12,
                      marginBottom: 18,
                    }}
                  >
                    <div>
                      <small>Total de la nota</small>
                      <div>
                        <strong>{moneda(notaActual.total)}</strong>
                      </div>
                    </div>
                    <div>
                      <small>Pagado</small>
                      <div>
                        <strong>{moneda(pagoActual.pagado)}</strong>
                      </div>
                    </div>
                    <div>
                      <small>Saldo pendiente</small>
                      <div>
                        <strong>{moneda(pagoActual.saldo)}</strong>
                      </div>
                    </div>
                    <div>
                      <small>Estado</small>
                      <div>
                        <strong>{pagoActual.estado}</strong>
                      </div>
                    </div>
                  </div>
                  {pagoActual.saldo > 0.005 && (
                    <>
                      <div className="cm-factura-fields">
                        <div className="cm-factura-field">
                          <label>Importe del abono (MXN)</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={montoPago}
                            onChange={(e) => setMontoPago(e.target.value)}
                          />
                        </div>
                        <div className="cm-factura-field">
                          <label>Fecha del pago</label>
                          <input
                            type="date"
                            value={fechaPago}
                            onChange={(e) => setFechaPago(e.target.value)}
                          />
                        </div>
                        <div className="cm-factura-field">
                          <label>Método de pago</label>
                          <select
                            value={metodoPago}
                            onChange={(e) => setMetodoPago(e.target.value)}
                            style={{
                              width: "100%",
                              minHeight: 47,
                              fontSize: 16,
                            }}
                          >
                            <option>Transferencia</option>
                            <option>Efectivo</option>
                            <option>Cheque</option>
                            <option>Otro</option>
                          </select>
                        </div>
                        <div className="cm-factura-field">
                          <label>Referencia (opcional)</label>
                          <input
                            type="text"
                            placeholder="Número de operación"
                            value={referenciaPago}
                            onChange={(e) => setReferenciaPago(e.target.value)}
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          marginTop: 16,
                        }}
                      >
                        <button
                          type="button"
                          className="cm-factura-clear"
                          disabled={registrandoPago || guardando}
                          onClick={() => registrarPago(false)}
                        >
                          {registrandoPago
                            ? "Registrando..."
                            : "Registrar abono"}
                        </button>
                        <button
                          type="button"
                          className="cm-factura-clear"
                          disabled={registrandoPago || guardando}
                          onClick={() => registrarPago(true)}
                          style={{ background: "#16834b", color: "white" }}
                        >
                          Registrar pago completo ({moneda(pagoActual.saldo)})
                        </button>
                      </div>
                    </>
                  )}
                  {pagosDeNota(notaActual).length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <h3>Historial de pagos</h3>
                      {pagosDeNota(notaActual).map((pago) => (
                        <div
                          key={pago.id}
                          style={{
                            padding: "10px 0",
                            borderBottom: "1px solid #e3e8ef",
                          }}
                        >
                          <strong>{moneda(pago.monto)}</strong> ·{" "}
                          {fechaTexto(pago.fecha)} · {pago.metodo}
                          {pago.referencia && (
                            <div style={{ fontSize: 12 }}>
                              Referencia: {pago.referencia}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <aside className="cm-factura-sidebar">
            <div className="cm-factura-summary">
              <span>RESUMEN DE LA NOTA</span>
              <p>Total general</p>
              <strong>{moneda(total)}</strong>

              <div className="cm-factura-summary-details">
                <div>
                  <span>Folio</span>
                  <b>{datos.folio || "Pendiente"}</b>
                </div>
                <div>
                  <span>Conceptos</span>
                  <b>{datos.items.length}</b>
                </div>
                <div>
                  <span>Moneda</span>
                  <b>MXN</b>
                </div>
              </div>

              <button
                type="button"
                className="cm-factura-pdf"
                disabled={guardando}
                onClick={guardarNota}
                style={{
                  background: "#16834b",
                  marginBottom: 12,
                }}
              >
                {guardando
                  ? "Guardando..."
                  : notaId
                    ? "Guardar cambios"
                    : "Guardar nota y generar folio"}
              </button>

              <button
                type="button"
                className="cm-factura-pdf"
                onClick={generarPDF}
                disabled={generando || guardando}
              >
                {generando ? "Generando PDF..." : "Descargar PDF"}
                {!generando && <span>↓</span>}
              </button>

              {mensaje && (
                <p className="cm-factura-message" role="status">
                  {mensaje}
                </p>
              )}

              {error && (
                <p
                  role="alert"
                  style={{
                    color: "#ffb4b4",
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  {error}
                </p>
              )}
            </div>

            <div className="cm-factura-help">
              <strong>Guardado en Firebase</strong>
              <p>
                El folio se genera al guardar por primera vez. Al editar una
                nota se conserva su número original.
              </p>
            </div>
          </aside>
        </div>

        <section className="cm-factura-preview-section">
          <div className="cm-factura-preview-heading">
            <div>
              <span className="cm-factura-eyebrow">DOCUMENTO</span>
              <h2>Vista previa de la nota</h2>
            </div>
          </div>

          <div className="cm-factura-preview-scroll">
            <div id="cm-nota-documento" className="cm-nota-documento">
              <div className="cm-nota-top">
                <div>
                  <span className="cm-nota-kicker">
                    CONSTRUCCIONES Y MATERIALES
                  </span>
                  <h2>CONSTRUMAT</h2>
                  <p>NOTA DE COBRO</p>
                  <p style={{ marginTop: 8 }}>{datos.folio || "SIN FOLIO"}</p>
                </div>
                <img src={Logo} alt="Construmat" />
              </div>

              <div className="cm-nota-info">
                <div>
                  <span>CLIENTE</span>
                  <strong>{datos.customerName || "Sin especificar"}</strong>
                </div>

                <div>
                  <span>FECHA</span>
                  <strong>{fechaTexto(datos.date)}</strong>
                </div>

                <div>
                  <span>TRABAJO</span>
                  <strong>{datos.customerTrabajo || "Sin especificar"}</strong>
                </div>

                <div>
                  <span>FOLIO</span>
                  <strong>{datos.folio || "Pendiente"}</strong>
                </div>
              </div>

              <table className="cm-nota-tabla">
                <thead>
                  <tr>
                    <th>DESCRIPCIÓN</th>
                    <th>UNIDAD</th>
                    <th>CANT.</th>
                    <th>P. UNITARIO</th>
                    <th>IMPORTE</th>
                  </tr>
                </thead>

                <tbody>
                  {datos.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description || "—"}</td>
                      <td>{item.unit || "—"}</td>
                      <td>{item.quantity || "0"}</td>
                      <td>{moneda(item.price)}</td>
                      <td>
                        {moneda(
                          (Number(item.quantity) || 0) *
                            (Number(item.price) || 0),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="cm-nota-total-row">
                <span>TOTAL GENERAL</span>
                <strong>{moneda(total)}</strong>
              </div>

              {datos.observations.trim() && (
                <div className="cm-nota-observaciones">
                  <strong>OBSERVACIONES</strong>
                  <p>{datos.observations}</p>
                </div>
              )}

              <div className="cm-nota-firma">
                <div className="cm-nota-firma-line" />
                <span>FORMULÓ</span>
                <strong>Lic. Rafael Piñón González</strong>
              </div>

              <div className="cm-nota-footer">
                CONSTRUMAT · CONSTRUCCIONES Y MATERIALES
              </div>
            </div>
          </div>
        </section>

        {/* PANEL DE COBROS: vistas de pagadas, pendientes y todas */}
        <section
          className="cm-factura-panel"
          style={{ marginTop: 32 }}
          id="cm-panel-cobros"
        >
          <div className="cm-factura-panel-heading">
            <div className="cm-factura-step">05</div>
            <div>
              <h2>Control de cobros</h2>
              <p>
                Consulta todas tus notas pagadas, pendientes e ingresos por
                método de pago.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setVistaCobros("pagadas");
                setFiltroMetodo("Todos");
              }}
              style={{
                padding: 18,
                textAlign: "left",
                borderRadius: 12,
                cursor: "pointer",
                border:
                  vistaCobros === "pagadas"
                    ? "3px solid #15803d"
                    : "1px solid #bbf7d0",
                background: "#f0fdf4",
                color: "#14532d",
              }}
            >
              <span style={{ display: "block", fontWeight: 800 }}>
                ✓ NOTAS PAGADAS ({resumenCobros.cantidadPagadas})
              </span>
              <strong style={{ display: "block", fontSize: 26, marginTop: 8 }}>
                {moneda(resumenCobros.totalPagadas)}
              </strong>
              <small>Ver todas las notas liquidadas</small>
            </button>
            <button
              type="button"
              onClick={() => {
                setVistaCobros("pendientes");
                setFiltroMetodo("Todos");
              }}
              style={{
                padding: 18,
                textAlign: "left",
                borderRadius: 12,
                cursor: "pointer",
                border:
                  vistaCobros === "pendientes"
                    ? "3px solid #b45309"
                    : "1px solid #fde68a",
                background: "#fffbeb",
                color: "#78350f",
              }}
            >
              <span style={{ display: "block", fontWeight: 800 }}>
                ◷ PENDIENTES ({resumenCobros.cantidadPendientes})
              </span>
              <strong style={{ display: "block", fontSize: 26, marginTop: 8 }}>
                {moneda(cartera.pendiente)}
              </strong>
              <small>Incluye saldos de notas abonadas</small>
            </button>
            <button
              type="button"
              onClick={() => {
                setVistaCobros("todas");
                setFiltroMetodo("Todos");
              }}
              style={{
                padding: 18,
                textAlign: "left",
                borderRadius: 12,
                cursor: "pointer",
                border:
                  vistaCobros === "todas"
                    ? "3px solid #1d4ed8"
                    : "1px solid #bfdbfe",
                background: "#eff6ff",
                color: "#1e3a8a",
              }}
            >
              <span style={{ display: "block", fontWeight: 800 }}>
                TODOS LOS COBROS
              </span>
              <strong style={{ display: "block", fontSize: 26, marginTop: 8 }}>
                {moneda(cartera.cobrado)}
              </strong>
              <small>Pagos y abonos recibidos</small>
            </button>
          </div>

          <div
            style={{
              padding: 16,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              marginBottom: 20,
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 17 }}>
              ¿Cuánto dinero entró por cada método?
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
              {["Todos", "Transferencia", "Efectivo", "Cheque"].map(
                (metodo) => (
                  <button
                    key={metodo}
                    type="button"
                    onClick={() => setFiltroMetodo(metodo)}
                    style={{
                      border:
                        filtroMetodo === metodo
                          ? "2px solid #1d4ed8"
                          : "1px solid #cbd5e1",
                      borderRadius: 9,
                      padding: "11px 14px",
                      background: filtroMetodo === metodo ? "#dbeafe" : "white",
                      color: "#172033",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {metodo === "Todos" ? "Todos los métodos" : metodo}
                    <span
                      style={{ display: "block", fontSize: 17, marginTop: 5 }}
                    >
                      {moneda(
                        metodo === "Todos"
                          ? cartera.cobrado
                          : resumenCobros.ingresos[metodo],
                      )}
                    </span>
                  </button>
                ),
              )}
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "12px 0 0" }}>
              Los importes de los botones incluyen pagos y abonos de todas las
              notas. Al seleccionar un método se muestran las notas que
              recibieron dinero por ese medio.
              {resumenCobros.ingresos.Otro > 0
                ? ` Otros métodos: ${moneda(resumenCobros.ingresos.Otro)}.`
                : ""}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>
                {vistaCobros === "pagadas"
                  ? "Notas pagadas"
                  : vistaCobros === "pendientes"
                    ? "Notas pendientes de pagar"
                    : "Todas las notas"}
              </h3>
              <small style={{ color: "#64748b" }}>
                {notasFiltradas.length} notas encontradas
              </small>
            </div>
            <div style={{ textAlign: "right" }}>
              <small>
                {vistaCobros === "pendientes"
                  ? "Saldo pendiente en esta lista"
                  : vistaCobros === "pagadas"
                    ? "Total de notas liquidadas en esta lista"
                    : "Dinero cobrado en esta lista"}
              </small>
              <strong style={{ display: "block", fontSize: 22 }}>
                {moneda(totalVista)}
              </strong>
              {filtroMetodo !== "Todos" && (
                <small>
                  Recibido por {filtroMetodo.toLowerCase()} en esta lista:{" "}
                  <strong>{moneda(totalMetodoFiltrado)}</strong>
                </small>
              )}
            </div>
          </div>
          <div className="cm-factura-field">
            <label>Buscar nota</label>
            <input
              type="search"
              placeholder="Buscar por cliente, trabajo o folio..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          {cargando ? (
            <p>Cargando notas...</p>
          ) : notasFiltradas.length === 0 ? (
            <p style={{ color: "#758295" }}>No hay notas para mostrar.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 12,
                marginTop: 22,
              }}
            >
              {notasFiltradas.map((nota) => (
                <div
                  key={nota.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 15,
                    padding: 18,
                    border:
                      resumenPagos(nota).estado === "Pagada"
                        ? "2px solid #86efac"
                        : "1px solid #e3e8ef",
                    background:
                      resumenPagos(nota).estado === "Pagada"
                        ? "#f0fdf4"
                        : "white",
                    borderRadius: 10,
                  }}
                >
                  <div>
                    <strong
                      style={{
                        display: "block",
                        color: "#c72c35",
                        marginBottom: 5,
                      }}
                    >
                      {nota.folio}
                    </strong>

                    <strong>{nota.customerName}</strong>

                    <p
                      style={{
                        color: "#758295",
                        fontSize: 12,
                        margin: "6px 0",
                      }}
                    >
                      {nota.customerTrabajo || "Sin nombre de trabajo"}
                      {" · "}
                      {fechaTexto(nota.date)}
                    </p>

                    <strong>{moneda(nota.total)}</strong>
                    <p style={{ margin: "6px 0", fontSize: 13 }}>
                      Estado:{" "}
                      <strong>
                        {resumenPagos(nota).estado === "Pagada"
                          ? "✓ PAGADA"
                          : resumenPagos(nota).estado}
                      </strong>{" "}
                      · Saldo:{" "}
                      <strong>{moneda(resumenPagos(nota).saldo)}</strong>
                      {pagosDeNota(nota).length > 0 && (
                        <span style={{ display: "block", marginTop: 5 }}>
                          Pagado:{" "}
                          <strong>{moneda(resumenPagos(nota).pagado)}</strong> ·{" "}
                          {pagosDeNota(nota)
                            .map((p) => p.metodo)
                            .filter((v, i, a) => a.indexOf(v) === i)
                            .join(", ")}
                        </span>
                      )}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="cm-factura-clear"
                      onClick={() => abrirNota(nota)}
                    >
                      Abrir / Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNotaEliminar(nota);
                        setClaveEliminar("");
                        setError("");
                      }}
                      style={{
                        padding: "10px 14px",
                        border: "1px solid #b91c1c",
                        borderRadius: 8,
                        color: "#b91c1c",
                        background: "white",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      {notaEliminar && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15,23,42,.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <form
            onSubmit={eliminarNotaDefinitivamente}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cm-eliminar-titulo"
            style={{
              background: "white",
              borderRadius: 14,
              padding: 24,
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 20px 60px #0004",
              color: "#172033",
            }}
          >
            <h2 id="cm-eliminar-titulo" style={{ marginTop: 0 }}>
              Eliminar nota definitivamente
            </h2>
            <p>
              Vas a eliminar <strong>{notaEliminar.folio}</strong> de{" "}
              <strong>{notaEliminar.customerName}</strong>, incluyendo todos sus
              pagos y abonos registrados.
            </p>
            <p style={{ color: "#b91c1c", fontWeight: 700 }}>
              Esta acción no se puede deshacer.
            </p>
            <label
              htmlFor="cm-clave-eliminar"
              style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
            >
              Confirma tu contraseña de acceso
            </label>
            <input
              id="cm-clave-eliminar"
              type="password"
              autoComplete="current-password"
              value={claveEliminar}
              onChange={(e) => setClaveEliminar(e.target.value)}
              placeholder="Contraseña"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 12,
                fontSize: 16,
                border: "1px solid #cbd5e1",
                borderRadius: 8,
              }}
            />
            {error && (
              <p role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>
                {error}
              </p>
            )}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 20,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                disabled={eliminando}
                onClick={() => {
                  setNotaEliminar(null);
                  setClaveEliminar("");
                  setError("");
                }}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "white",
                  color: "#172033",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={eliminando || !claveEliminar}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  border: 0,
                  background: "#b91c1c",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {eliminando ? "Eliminando..." : "Eliminar definitivamente"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
