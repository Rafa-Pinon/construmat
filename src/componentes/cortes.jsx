import React, { useState, useEffect } from "react";

function Cortes() {
  const [myIncomes, setMyIncomes] = useState([]);
  const [myExpenses, setMyExpenses] = useState([]);
  const [partnerIncomes, setPartnerIncomes] = useState([]);
  const [partnerExpenses, setPartnerExpenses] = useState([]);
  const [concept, setConcept] = useState("");
  const [value, setValue] = useState("");
  const [partnerConcept, setPartnerConcept] = useState("");
  const [partnerValue, setPartnerValue] = useState("");

  // Cargar datos desde localStorage
  useEffect(() => {
    const savedMyIncomes = JSON.parse(localStorage.getItem("myIncomes")) || [];
    const savedMyExpenses =
      JSON.parse(localStorage.getItem("myExpenses")) || [];
    const savedPartnerIncomes =
      JSON.parse(localStorage.getItem("partnerIncomes")) || [];
    const savedPartnerExpenses =
      JSON.parse(localStorage.getItem("partnerExpenses")) || [];

    setMyIncomes(savedMyIncomes);
    setMyExpenses(savedMyExpenses);
    setPartnerIncomes(savedPartnerIncomes);
    setPartnerExpenses(savedPartnerExpenses);
  }, []);

  // Guardar datos en localStorage
  useEffect(() => {
    localStorage.setItem("myIncomes", JSON.stringify(myIncomes));
    localStorage.setItem("myExpenses", JSON.stringify(myExpenses));
    localStorage.setItem("partnerIncomes", JSON.stringify(partnerIncomes));
    localStorage.setItem("partnerExpenses", JSON.stringify(partnerExpenses));
  }, [myIncomes, myExpenses, partnerIncomes, partnerExpenses]);

  // Agregar ingresos y gastos
  const handleAddIncome = () => {
    if (concept && value) {
      setMyIncomes([...myIncomes, { concept, value: parseFloat(value) }]);
      setConcept("");
      setValue("");
    }
  };

  const handleAddExpense = () => {
    if (concept && value) {
      setMyExpenses([...myExpenses, { concept, value: parseFloat(value) }]);
      setConcept("");
      setValue("");
    }
  };

  const handleAddPartnerIncome = () => {
    if (partnerConcept && partnerValue) {
      setPartnerIncomes([
        ...partnerIncomes,
        { concept: partnerConcept, value: parseFloat(partnerValue) },
      ]);
      setPartnerConcept("");
      setPartnerValue("");
    }
  };

  const handleAddPartnerExpense = () => {
    if (partnerConcept && partnerValue) {
      setPartnerExpenses([
        ...partnerExpenses,
        { concept: partnerConcept, value: parseFloat(partnerValue) },
      ]);
      setPartnerConcept("");
      setPartnerValue("");
    }
  };

  // Eliminar conceptos
  const handleDeleteIncome = (index) => {
    setMyIncomes(myIncomes.filter((_, i) => i !== index));
  };

  const handleDeleteExpense = (index) => {
    setMyExpenses(myExpenses.filter((_, i) => i !== index));
  };

  const handleDeletePartnerIncome = (index) => {
    setPartnerIncomes(partnerIncomes.filter((_, i) => i !== index));
  };

  const handleDeletePartnerExpense = (index) => {
    setPartnerExpenses(partnerExpenses.filter((_, i) => i !== index));
  };

  // Limpiar formularios con confirmación
  const handleClearData = () => {
    if (
      window.confirm(
        "¿Seguro que deseas eliminar toda la información de las tablas?"
      )
    ) {
      setMyIncomes([]);
      setMyExpenses([]);
      setPartnerIncomes([]);
      setPartnerExpenses([]);
    }
  };

  // Calcular totales
  const calculateTotal = (rows) =>
    rows.reduce((acc, row) => acc + row.value, 0);

  const myTotalIncome = calculateTotal(myIncomes);
  const myTotalExpense = calculateTotal(myExpenses);
  const partnerTotalIncome = calculateTotal(partnerIncomes);
  const partnerTotalExpense = calculateTotal(partnerExpenses);

  // Comparaciones
  const myNetIncome = myTotalIncome - myTotalExpense;
  const partnerNetIncome = partnerTotalIncome - partnerTotalExpense;

  const amountToGiveToPartner =
    myNetIncome > partnerNetIncome ? (myNetIncome - partnerNetIncome) / 2 : 0;
  const amountToCollectFromPartner =
    partnerNetIncome > myNetIncome ? (partnerNetIncome - myNetIncome) / 2 : 0;

  return (
    <div className="container">
      <div className="table-container">
        {/* Tabla para ti */}
        <div className="table-section">
          <h2>Mis Ingresos y Gastos</h2>
          <div className="form">
            <input
              type="text"
              placeholder="Concepto"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="input"
            />
            <input
              type="number"
              placeholder="Valor"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="input"
            />
            <button onClick={handleAddIncome} className="button income">
              Agregar Ingreso
            </button>
            <button onClick={handleAddExpense} className="button expense">
              Agregar Gasto
            </button>
          </div>
          <div className="table-row">
            <div className="table-column">
              <h3>Ingresos</h3>
              <table>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Valor</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {myIncomes.map((income, index) => (
                    <tr key={`my-income-${index}`}>
                      <td>{income.concept}</td>
                      <td>
                        $
                        {income.value.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        <button
                          className="delete-button"
                          onClick={() => handleDeleteIncome(index)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <strong>Total Ingresos</strong>
                    </td>
                    <td>
                      <strong>
                        $
                        {myTotalIncome.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="table-column">
              <h3>Gastos</h3>
              <table>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Valor</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {myExpenses.map((expense, index) => (
                    <tr key={`my-expense-${index}`}>
                      <td>{expense.concept}</td>
                      <td>
                        -$
                        {expense.value.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        <button
                          className="delete-button"
                          onClick={() => handleDeleteExpense(index)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <strong>Total Gastos</strong>
                    </td>
                    <td>
                      <strong>
                        -$
                        {myTotalExpense.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Tabla para tu socio */}
        <div className="table-section">
          <h2>Ingresos y Gastos de mi Papa</h2>
          <div className="form">
            <input
              type="text"
              placeholder="Concepto"
              value={partnerConcept}
              onChange={(e) => setPartnerConcept(e.target.value)}
              className="input"
            />
            <input
              type="number"
              placeholder="Valor"
              value={partnerValue}
              onChange={(e) => setPartnerValue(e.target.value)}
              className="input"
            />
            <button onClick={handleAddPartnerIncome} className="button income">
              Agregar Ingreso Papa
            </button>
            <button
              onClick={handleAddPartnerExpense}
              className="button expense"
            >
              Agregar Gasto Papa
            </button>
          </div>
          <div className="table-row">
            <div className="table-column">
              <h3>Ingresos Papa</h3>
              <table>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Valor</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerIncomes.map((income, index) => (
                    <tr key={`partner-income-${index}`}>
                      <td>{income.concept}</td>
                      <td>
                        $
                        {income.value.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        <button
                          className="delete-button"
                          onClick={() => handleDeletePartnerIncome(index)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <strong>Total Ingresos Papa</strong>
                    </td>
                    <td>
                      <strong>
                        $
                        {partnerTotalIncome.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="table-column">
              <h3>Gastos Papa</h3>
              <table>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Valor</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerExpenses.map((expense, index) => (
                    <tr key={`partner-expense-${index}`}>
                      <td>{expense.concept}</td>
                      <td>
                        -$
                        {expense.value.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td>
                        <button
                          className="delete-button"
                          onClick={() => handleDeletePartnerExpense(index)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <strong>Total Gastos Papa</strong>
                    </td>
                    <td>
                      <strong>
                        -$
                        {partnerTotalExpense.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Resultados */}
      <div className="results">
        <h2>Resultados de Pagos</h2>
        <p>
          Tú le debes a tu Papa:{" "}
          <span
            className={`highlight ${
              amountToGiveToPartner > 0 ? "red-text" : ""
            }`}
          >
            $
            {amountToGiveToPartner.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </p>
        <p>
          Tu Papa te debe:{" "}
          <span
            className={`highlight ${
              amountToCollectFromPartner > 0 ? "red-text" : ""
            }`}
          >
            $
            {amountToCollectFromPartner.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </p>
      </div>

      <button className="button" onClick={handleClearData}>
        Limpiar Formularios
      </button>
    </div>
  );
}

export default Cortes;
