import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import chaveImg from "../assets/chave5.jpeg";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError("Email ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-visual">
        <img src={chaveImg} alt="Controle de Chaves" className="login-visual-img" />
        <div className="login-visual-overlay" />
        <div className="login-visual-content">
          <div className="login-visual-icon">&#128273;</div>
          <h2>Controle de Chaves</h2>
          <p>Sistema de gerenciamento de chaves</p>
        </div>
      </div>

      <div className="login-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form-header">
            <h1>Entrar</h1>
            <p>Acesse sua conta para continuar</p>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
