import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = login(username, password);
      if (!success) {
        setError('Usuario o contraseña incorrectos');
        setPassword('');
      }
    } catch (e) {
      setError('Error al iniciar sesión');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                <LogIn className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">FerrePOS</h1>
            <p className="text-gray-300">Sistema POS para Ferretería</p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3"
            >
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-red-200 text-sm">{error}</p>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="username" className="text-white mb-2 block">
                Usuario
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="admin o empleado"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 bg-white/5 border-white/20 text-white placeholder-gray-400"
                autoComplete="username"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-white mb-2 block">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-white/5 border-white/20 text-white placeholder-gray-400"
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || !username.trim() || !password.trim()}
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold"
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8 pt-6 border-t border-white/20">
            <p className="text-gray-300 text-sm mb-3 font-semibold">Credenciales de prueba:</p>
            <div className="space-y-2 text-sm">
              <div className="bg-white/5 p-3 rounded-lg">
                <p className="text-gray-400">
                  <span className="text-blue-400 font-medium">Admin:</span> admin / admin
                </p>
              </div>
              <div className="bg-white/5 p-3 rounded-lg">
                <p className="text-gray-400">
                  <span className="text-green-400 font-medium">Empleado:</span> empleado / 1234
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
