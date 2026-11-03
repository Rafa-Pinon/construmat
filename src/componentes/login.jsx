import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, authReady } from "../firebase";
import Logo from "../logo/logo.png";
import "../Login.css";

export default function Login() {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function ingresar(evento) {
    evento.preventDefault();
    setError("");
    setCargando(true);

    try {
      await authReady;

      await signInWithEmailAndPassword(auth, correo.trim(), password);
    } catch (err) {
      if (err.code === "auth/too-many-requests") {
        setError(
          "Demasiados intentos. Espera unos minutos antes de volver a intentar.",
        );
      } else {
        setError("No se pudo ingresar. Revisa tu correo y contraseña.");
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="cm-login-page">
      <div className="cm-login-layout">
        <section className="cm-login-presentation">
          <div className="cm-login-brand">
            <img src={Logo} alt="Construmat" />
            <div>
              <strong>CONSTRUMAT</strong>
              <span>Construcciones y Materiales</span>
            </div>
          </div>

          <div className="cm-login-presentation-content">
            <span className="cm-login-eyebrow">SISTEMA ADMINISTRATIVO</span>

            <h1>
              El control de tu empresa,
              <span> en un solo lugar.</span>
            </h1>

            <p>
              Organiza tus notas de cobro, recibos y cortes desde una plataforma
              diseñada para Construmat.
            </p>
          </div>

          <div className="cm-login-presentation-footer">
            CONSTRUMAT · ACCESO PRIVADO
          </div>
        </section>

        <section className="cm-login-form-section">
          <div className="cm-login-form-container">
            <div className="cm-login-mobile-logo">
              <img src={Logo} alt="Construmat" />
              <strong>CONSTRUMAT</strong>
            </div>

            <div className="cm-login-lock">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
            </div>

            <span className="cm-login-small-title">BIENVENIDO DE NUEVO</span>

            <h2>Iniciar sesión</h2>

            <p className="cm-login-description">
              Ingresa tus credenciales para acceder al panel administrativo.
            </p>

            <form onSubmit={ingresar}>
              <label htmlFor="cm-correo">Correo electrónico</label>

              <input
                id="cm-correo"
                type="email"
                autoComplete="username"
                placeholder="correo@ejemplo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                disabled={cargando}
              />

              <label htmlFor="cm-password">Contraseña</label>

              <div className="cm-login-password-wrapper">
                <input
                  id="cm-password"
                  type={mostrarPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Escribe tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={cargando}
                />

                <button
                  type="button"
                  className="cm-login-show-password"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  aria-label={
                    mostrarPassword
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                >
                  {mostrarPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>

              {error && (
                <div className="cm-login-error" role="alert">
                  {error}
                </div>
              )}

              <button
                className="cm-login-submit"
                type="submit"
                disabled={cargando}
              >
                {cargando ? "Verificando..." : "Ingresar al sistema"}
                {!cargando && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <div className="cm-login-security">
              <span aria-hidden="true">●</span>
              Acceso protegido con Firebase Authentication
            </div>
          </div>

          <div className="cm-login-copyright">
            © {new Date().getFullYear()} Construmat. Construcciones y
            Materiales.
          </div>
        </section>
      </div>
    </main>
  );
}
