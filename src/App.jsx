import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";

import { onAuthStateChanged, signOut } from "firebase/auth";

import { auth, authReady } from "./firebase";

import Logo from "./logo/logo.png";
import Login from "./componentes/login";
import Factura from "./componentes/factura";
import Cortes from "./componentes/cortes";
import Recibos from "./componentes/recibos";

import "./App.css";
import "./factura.css";

import "./recibos_test.css";

const herramientas = [
  {
    numero: "01",
    titulo: "Notas de cobro",
    descripcion:
      "Elabora notas profesionales para tus clientes, agrega conceptos y descarga tus documentos.",
    ruta: "/factura",
    accion: "Crear nota",
    icono: "factura",
  },
  {
    numero: "02",
    titulo: "Cortes",
    descripcion:
      "Organiza los ingresos y gastos de tus trabajos y mantén un mejor control de tus operaciones.",
    ruta: "/cortes",
    accion: "Abrir cortes",
    icono: "cortes",
  },
  {
    numero: "03",
    titulo: "Recibos",
    descripcion:
      "Prepara comprobantes claros y profesionales para entregar a tus clientes.",
    ruta: "/recibos",
    accion: "Crear recibo",
    icono: "recibos",
  },
];

function Icono({ tipo, size = 28 }) {
  const comunes = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (tipo === "factura") {
    return (
      <svg {...comunes}>
        <path d="M7 3h10a2 2 0 0 1 2 2v16l-3-2-4 2-4-2-3 2V5a2 2 0 0 1 2-2Z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </svg>
    );
  }

  if (tipo === "cortes") {
    return (
      <svg {...comunes}>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M3 9h18M9 9v12M13 14h4M13 17h4" />
      </svg>
    );
  }

  if (tipo === "recibos") {
    return (
      <svg {...comunes}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h4" />
        <path d="m14 16 2 2 4-4" />
      </svg>
    );
  }

  return null;
}

function Home({ usuario }) {
  const [cerrando, setCerrando] = useState(false);
  const [errorSalida, setErrorSalida] = useState("");

  async function cerrarSesion() {
    setCerrando(true);
    setErrorSalida("");

    try {
      await signOut(auth);
    } catch {
      setErrorSalida("No se pudo cerrar la sesión.");
      setCerrando(false);
    }
  }

  return (
    <div className="cm-app">
      <header className="cm-header">
        <div className="cm-header-inner">
          <Link to="/" className="cm-brand">
            <div className="cm-brand-logo">
              <img src={Logo} alt="Logotipo Construmat" />
            </div>

            <div className="cm-brand-info">
              <span className="cm-brand-name">CONSTRUMAT</span>
              <span className="cm-brand-subtitle">
                Construcciones y Materiales
              </span>
            </div>
          </Link>

          <div className="cm-header-right">
            <span className="cm-online-indicator" />
            <span className="cm-header-label">Panel administrativo</span>

            <button
              type="button"
              onClick={cerrarSesion}
              disabled={cerrando}
              style={{
                border: "1px solid #e5e9ef",
                background: "#fff",
                color: "#c72c35",
                padding: "11px 15px",
                borderRadius: "9px",
                cursor: cerrando ? "wait" : "pointer",
                fontWeight: 750,
                fontSize: "12px",
              }}
            >
              {cerrando ? "Saliendo..." : "Cerrar sesión"}
            </button>
          </div>
        </div>
      </header>

      <main className="cm-content">
        {errorSalida && (
          <p role="alert" style={{ color: "#c72c35" }}>
            {errorSalida}
          </p>
        )}

        <section className="cm-welcome">
          <div className="cm-welcome-content">
            <div className="cm-welcome-badge">
              <span className="cm-badge-line" />
              CENTRO DE OPERACIONES
            </div>

            <h1>
              Bienvenido a
              <br />
              <span>Construmat.</span>
            </h1>

            <p>
              Administra tus documentos y operaciones desde un solo lugar.
              Herramientas diseñadas para hacer tu trabajo más sencillo, rápido
              y organizado.
            </p>

            <a href="#herramientas" className="cm-main-button">
              Explorar herramientas
              <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div className="cm-welcome-visual">
            <div className="cm-visual-circle">
              <div className="cm-visual-inner">
                <img src={Logo} alt="" />
              </div>
            </div>

            <div className="cm-visual-caption">CONSTRUCCIONES Y MATERIALES</div>
          </div>

          <div className="cm-welcome-decoration" />
        </section>

        <section className="cm-tools-section" id="herramientas">
          <div className="cm-section-header">
            <div>
              <div className="cm-section-eyebrow">TU ESPACIO DE TRABAJO</div>

              <h2>Herramientas administrativas</h2>

              <p>Selecciona una herramienta para comenzar.</p>
            </div>

            <div className="cm-module-count">
              <strong>03</strong>
              <span>Módulos disponibles</span>
            </div>
          </div>

          <div className="cm-tools-grid">
            {herramientas.map((herramienta) => (
              <Link
                key={herramienta.ruta}
                to={herramienta.ruta}
                className="cm-tool-card"
              >
                <div className="cm-card-header">
                  <div className="cm-card-icon">
                    <Icono tipo={herramienta.icono} />
                  </div>

                  <span className="cm-card-number">{herramienta.numero}</span>
                </div>

                <div className="cm-card-body">
                  <h3>{herramienta.titulo}</h3>
                  <p>{herramienta.descripcion}</p>
                </div>

                <div className="cm-card-footer">
                  <span>{herramienta.accion}</span>

                  <div className="cm-card-arrow">
                    <span aria-hidden="true">↗</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="cm-bottom-banner">
          <div className="cm-bottom-symbol">
            <span>CM</span>
          </div>

          <div className="cm-bottom-text">
            <h3>Construmat</h3>
            <p>
              Construcciones y Materiales · Organización y eficiencia en cada
              proyecto.
            </p>
          </div>

          <span className="cm-bottom-decoration">SISTEMA ADMINISTRATIVO</span>
        </section>
      </main>

      <footer className="cm-footer">
        <div className="cm-footer-inner">
          <span>
            © {new Date().getFullYear()} CONSTRUMAT. Todos los derechos
            reservados.
          </span>
          <span>Construcciones y Materiales</span>
        </div>
      </footer>
    </div>
  );
}

function App() {
  const [usuario, setUsuario] = useState(null);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    let activo = true;
    let cancelar = () => {};

    async function iniciarAutenticacion() {
      try {
        await authReady;

        if (!activo) return;

        cancelar = onAuthStateChanged(
          auth,
          (usuarioFirebase) => {
            setUsuario(usuarioFirebase);
            setVerificando(false);
          },
          (error) => {
            console.error("Error de autenticación:", error);
            setUsuario(null);
            setVerificando(false);
          },
        );
      } catch (error) {
        console.error("Error al iniciar Firebase:", error);
        if (activo) {
          setUsuario(null);
          setVerificando(false);
        }
      }
    }

    iniciarAutenticacion();

    return () => {
      activo = false;
      cancelar();
    };
  }, []);

  if (verificando) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#f5f7fa",
          color: "#22354a",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Verificando acceso a Construmat...
      </div>
    );
  }

  return (
    <BrowserRouter>
      {!usuario ? (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<Home usuario={usuario} />} />
          <Route path="/factura" element={<Factura />} />
          <Route path="/cortes" element={<Cortes />} />
          <Route path="/recibos" element={<Recibos />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;
