import { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom"; // Importamos useNavigate
import Logo from "../src/logo/logo.png";
import "./App.css";
import "./factura.css";
import "./cortes.css";
import Factura from "./componentes/factura";
import Cortes from "./componentes/cortes"; // Asegúrate de tener este componente

function App() {
  const [count, setCount] = useState(0);
  const navigate = useNavigate(); // Inicializamos el hook navigate

  // Función para manejar la navegación
  const goToFactura = () => {
    navigate("/factura"); // Redirige a /factura
  };

  const goToCortes = () => {
    navigate("/cortes"); // Redirige a /cortes
  };

  return (
    <div className="header">
      <div className="titulo">
        <h1>CONSTRUMAT</h1>
      </div>
      <div className="logoa">
        <img src={Logo} alt="Logo" />
      </div>
      <div className="button-container">
        {/* Usamos las funciones de navegación al hacer clic */}
        <button className="factura-button" onClick={goToFactura}>
          Factura
        </button>
        <button className="corte-button" onClick={goToCortes}>
          Corte
        </button>
      </div>
    </div>
  );
}

function AppWrapper() {
  return (
    <Router>
      <Routes>
        {/* Definir las rutas de la aplicación */}
        <Route path="/" element={<App />} />
        <Route path="/factura" element={<Factura />} />{" "}
        {/* Componente Factura */}
        <Route path="/cortes" element={<Cortes />} /> {/* Componente Cortes */}
      </Routes>
    </Router>
  );
}

export default AppWrapper;
