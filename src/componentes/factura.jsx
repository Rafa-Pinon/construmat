import React, { useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Logo from "../logo/logo.png";

function Factura() {
  const [invoiceData, setInvoiceData] = useState({
    customerName: "",
    date: "",
    items: [{ description: "", quantity: "1", price: "0", unit: "" }],
  });

  const handleInputChange = (e, index) => {
    const { name, value } = e.target;
    if (name.startsWith("item-")) {
      const items = [...invoiceData.items];
      items[index][name.split("-")[1]] = value;
      setInvoiceData({ ...invoiceData, items });
    } else {
      setInvoiceData({ ...invoiceData, [name]: value });
    }
  };

  const addItem = () => {
    setInvoiceData({
      ...invoiceData,
      items: [
        ...invoiceData.items,
        { description: "", quantity: "1", price: "0", unit: "" },
      ],
    });
  };

  const calculateTotal = () => {
    return invoiceData.items.reduce((total, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      return total + quantity * price;
    }, 0);
  };

  const generatePDF = () => {
    const input = document.getElementById("invoice");
    html2canvas(input).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF();
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
      pdf.save("invoice.pdf");
    });
  };

  const handleFocus = (e, index) => {
    const { name } = e.target;
    if (name.startsWith("item-")) {
      const field = name.split("-")[1];
      const items = [...invoiceData.items];
      if (field === "quantity" && items[index].quantity === "1") {
        items[index].quantity = "";
      }
      if (field === "price" && items[index].price === "0") {
        items[index].price = "";
      }
      setInvoiceData({ ...invoiceData, items });
    }
  };

  const handleBlur = (e, index) => {
    const { name } = e.target;
    if (name.startsWith("item-")) {
      const field = name.split("-")[1];
      const items = [...invoiceData.items];
      if (field === "quantity" && items[index].quantity === "") {
        items[index].quantity = "1";
      }
      if (field === "price" && items[index].price === "") {
        items[index].price = "0";
      }
      setInvoiceData({ ...invoiceData, items });
    }
  };

  return (
    <div className="app-container">
      <h1 className="title">FACTURAS CONSTRUMAT</h1>
      <form className="form-container">
        <div className="form-group">
          <label>Nombre del Cliente:</label>
          <input
            type="text"
            name="customerName"
            value={invoiceData.customerName}
            onChange={(e) => handleInputChange(e)}
          />
        </div>
        <div className="form-group">
          <label>Nombre del Trabajo:</label>
          <input
            type="text"
            name="customerTrabajo"
            value={invoiceData.customerTrabajo}
            onChange={(e) => handleInputChange(e)}
          />
        </div>
        <div className="form-group">
          <label>Fecha:</label>
          <input
            type="date"
            name="date"
            value={invoiceData.date}
            onChange={(e) => handleInputChange(e)}
          />
        </div>
        <h3 className="subtitle">Concepto</h3>
        {invoiceData.items.map((item, index) => (
          <div key={index} className="item-group">
            <input
              type="text"
              name="item-description"
              placeholder="Descripción"
              value={item.description}
              onChange={(e) => handleInputChange(e, index)}
            />
            <input
              type="text"
              name="item-unit"
              placeholder="Unidad (ej. kg, m, pcs)"
              value={item.unit}
              onChange={(e) => handleInputChange(e, index)}
            />
            <input
              type="number"
              name="item-quantity"
              placeholder="Cantidad"
              value={item.quantity}
              onFocus={(e) => handleFocus(e, index)}
              onBlur={(e) => handleBlur(e, index)}
              onChange={(e) => handleInputChange(e, index)}
            />
            <input
              type="number"
              name="item-price"
              placeholder="Precio"
              value={item.price}
              onFocus={(e) => handleFocus(e, index)}
              onBlur={(e) => handleBlur(e, index)}
              onChange={(e) => handleInputChange(e, index)}
            />
          </div>
        ))}
        <button type="button" onClick={addItem} className="btn btn-add">
          Añadir Ítem
        </button>
      </form>

      <div id="invoice" className="invoice-container">
        <div className="logo">
          <h3>Factura</h3>
          <img src={Logo} alt="" />
        </div>
        <div className="etiquetasp">
          <p>Cliente: {invoiceData.customerName}</p>
          <p>Trabajo: {invoiceData.customerTrabajo}</p>
          <p>Fecha: {invoiceData.date}</p>
        </div>
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Unidad</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoiceData.items.map((item, index) => (
              <tr key={index}>
                <td>{item.description}</td>
                <td>{item.unit}</td>
                <td>{item.quantity}</td>
                <td>{item.price}</td>
                <td>{item.quantity * item.price || 0}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan="4"
                style={{ fontWeight: "bold", textAlign: "right" }}
              >
                Total General:
              </td>
              <td style={{ fontWeight: "bold" }}>
                {calculateTotal().toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
        <div className="administrador">
          <h2>Formulo</h2>
          <h3>Lic. Rafael Pinon Gonzalez</h3>
        </div>
      </div>
      <button onClick={generatePDF} className="btn btn-generate">
        Generar PDF
      </button>
    </div>
  );
}

export default Factura;
