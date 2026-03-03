import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await register(name, email, password);
      toast.success('Conta criada com sucesso!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712] px-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-900/50 border border-white/5 rounded-lg p-8 backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gradient mb-2">LeadMiner</h1>
            <p className="text-gray-400">Crie sua conta gratuita</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                type="text"
                data-testid="register-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-gray-950/50 border-gray-800 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="register-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-gray-950/50 border-gray-800 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                data-testid="register-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-gray-950/50 border-gray-800 text-white"
              />
            </div>

            <Button
              type="submit"
              data-testid="register-submit-button"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                'Criar Conta'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-400">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-violet-400 hover:text-violet-300">
              Entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;