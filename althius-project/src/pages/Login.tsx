import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  supabase,
  isLocalAuthBypassEnabled,
  isSupabaseConfigured,
} from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Rocket } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const authDisabled = !isSupabaseConfigured && !isLocalAuthBypassEnabled;

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (authDisabled) return;
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Acesso negado. Verifique as coordenadas da sua conta.');
      setLoading(false);
      return;
    }

    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background althius-dot-bg px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 bg-primary flex items-center justify-center mb-6">
            <Rocket className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-[0.2em] text-primary">ALTHIUS</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">Command Center</p>
        </div>

        <div className="bg-card border border-border p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest">E-mail de Tripulação</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@althius.com"
                className="rounded-none border-border bg-background focus-visible:ring-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" title="Senha" className="text-[10px] font-bold uppercase tracking-widest">Código de Acesso</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="rounded-none border-border bg-background focus-visible:ring-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-destructive text-center">{error}</p>
            )}

            {authDisabled && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">
                Sistemas offline. Configure as chaves de acesso Supabase.
              </p>
            )}

            <Button 
              type="submit" 
              className="w-full rounded-none font-bold uppercase tracking-[0.2em] py-6" 
              disabled={loading || authDisabled}
            >
              {loading ? 'Iniciando Sequência...' : 'Iniciar Missão'}
            </Button>
          </form>
        </div>
        
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-muted-foreground/40">
            © 2026 Althius Aerospace Systems
          </p>
        </div>
      </div>
    </div>
  );
}
