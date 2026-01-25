import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Logo from "../logo/logo.png";

/* ===============================
   FUNCIÓN PARA GENERAR FOLIO
================================ */
const generarFolio = () => {
  const fecha = new Date();
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  const r = Math.floor(Math.random() * 1000);
  return `RC-${y}${m}${d}-${r}`;
};

const Recibos = () => {
  /* ===============================
     ESTADOS
  ================================ */
  const [folio, setFolio] = useState("");
  const [fecha, setFecha] = useState("");
  const [cliente, setCliente] = useState("");
  const [usarIVA, setUsarIVA] = useState(true);

  const [conceptos, setConceptos] = useState([
    { descripcion: "", unidad: "", cantidad: 1, precio: 0 },
  ]);

  /* ===============================
     GENERAR FOLIO AL CARGAR
  ================================ */
  useEffect(() => {
    setFolio(generarFolio());
  }, []);

  /* ===============================
     MANEJO DE CONCEPTOS
  ================================ */
  const agregarConcepto = () => {
    setConceptos([
      ...conceptos,
      { descripcion: "", unidad: "", cantidad: 1, precio: 0 },
    ]);
  };

  const eliminarConcepto = (index) => {
    setConceptos(conceptos.filter((_, i) => i !== index));
  };

  const actualizarConcepto = (index, campo, valor) => {
    const nuevos = [...conceptos];
    nuevos[index][campo] = valor;
    setConceptos(nuevos);
  };

  /* ===============================
     CÁLCULOS
  ================================ */
  const subtotal = conceptos.reduce((acc, c) => acc + c.cantidad * c.precio, 0);
  const iva = usarIVA ? subtotal * 0.16 : 0;
  const total = subtotal + iva;

  /* ===============================
     GENERAR PDF
  ================================ */
  const generarPDF = async () => {
    const elemento = document.getElementById("recibo-pdf");

    const canvas = await html2canvas(elemento, {
      scale: 2,
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "letter");

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`recibo-${folio}.pdf`);
  };

  /* ===============================
     JSX
  ================================ */
  return (
    <div className="recibo-container">
      {/* ===============================
         ZONA DE EDICIÓN (NO PDF)
      ================================ */}
      <div className="editor">
        <label>
          Fecha:
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>

        <label>
          Cliente:
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} />
        </label>

        <table>
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Unidad</th>
              <th>Cant.</th>
              <th>P.U.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {conceptos.map((c, index) => (
              <tr key={index}>
                <td>
                  <input
                    value={c.descripcion}
                    onChange={(e) =>
                      actualizarConcepto(index, "descripcion", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    value={c.unidad}
                    onChange={(e) =>
                      actualizarConcepto(index, "unidad", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={c.cantidad}
                    onChange={(e) =>
                      actualizarConcepto(
                        index,
                        "cantidad",
                        Number(e.target.value),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={c.precio}
                    onChange={(e) =>
                      actualizarConcepto(
                        index,
                        "precio",
                        Number(e.target.value),
                      )
                    }
                  />
                </td>
                <td>
                  <button
                    className="delete"
                    onClick={() => eliminarConcepto(index)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button className="add" onClick={agregarConcepto}>
          + Agregar concepto
        </button>

        <label className="iva">
          <input
            type="checkbox"
            checked={usarIVA}
            onChange={() => setUsarIVA(!usarIVA)}
          />
          Aplicar IVA (16%)
        </label>
      </div>

      {/* ===============================
         VISTA PDF
      ================================ */}
      <div className="recibo" id="recibo-pdf">
        <div className="header-pdf">
          <img src={Logo} className="logo-pdf" />
          <div className="folio-pdf">FOLIO: {folio}</div>
        </div>

        <h2 className="subtitulo">RECIBO DE PAGO</h2>

        <p>
          <strong>Fecha:</strong> {fecha}
        </p>
        <p>
          <strong>Cliente:</strong> {cliente}
        </p>

        <table className="tabla-pdf">
          <thead>
            <tr>
              <th>DESCRIPCIÓN</th>
              <th>UNIDAD</th>
              <th>CANT.</th>
              <th>P.U.</th>
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {conceptos.map((c, i) => (
              <tr key={i}>
                <td>{c.descripcion}</td>
                <td>{c.unidad}</td>
                <td>{c.cantidad}</td>
                <td>${c.precio.toFixed(2)}</td>
                <td>${(c.cantidad * c.precio).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totales-pdf">
          <p>SUBTOTAL: ${subtotal.toFixed(2)}</p>
          {usarIVA && <p>IVA: ${iva.toFixed(2)}</p>}
          <p className="total">TOTAL: ${total.toFixed(2)}</p>
        </div>

        <div className="firmas">
          <div>
            <p>FORMULA</p>
            <p className="nombre">LIC. RAFAEL PIÑON GONZALEZ</p>
          </div>

          <div>
            <hr />
            <p>RECIBIÓ</p>
          </div>
        </div>
      </div>

      <button className="pdf" onClick={generarPDF}>
        Generar PDF
      </button>
    </div>
  );
};

export default Recibos;
