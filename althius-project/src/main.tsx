import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

interface ErrorState {
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorState> {
  state: ErrorState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "2rem", fontFamily: "monospace" }}>
          <h2 style={{ color: "#dc2626" }}>Erro ao inicializar o app</h2>
          <pre style={{ background: "#fef2f2", padding: "1rem", borderRadius: "6px", overflowX: "auto" }}>
            {this.state.error.message}
          </pre>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Verifique o console para mais detalhes. Se o problema persistir, confira o arquivo{" "}
            <code>.env.local</code> e certifique-se de que as variáveis do Supabase estão preenchidas.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
