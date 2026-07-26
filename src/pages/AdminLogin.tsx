import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Phone } from 'lucide-react';

export default function AdminLogin() {
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setError('');

    const { data: configTel } = await supabase!.from('admin_config').select('valor').eq('chave', 'admin_telefone').single();
    const { data: configSenha } = await supabase!.from('admin_config').select('valor').eq('chave', 'admin_senha').single();

    if (configTel?.valor === telefone && configSenha?.valor === senha) {
      localStorage.setItem('bingo_admin', 'true');
      navigate('/admin/panel');
    } else {
      setError('Credenciais inválidas');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-sm relative z-10">
        <form onSubmit={handleLogin} className="bg-black/60 backdrop-blur-md border border-red-500/30 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8 flex flex-col items-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-950/30 rounded-2xl mb-4 border border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-red-500 to-red-200 uppercase tracking-tighter">Acesso Restrito</h1>
            <p className="text-[10px] text-red-500/80 mt-2 uppercase tracking-[0.2em] font-semibold">Painel do Caixa & Sorteio</p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder-gray-600"
                  placeholder="Telefone Administrativo"
                />
              </div>
            </div>

            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder-gray-600"
                  placeholder="Senha"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20">{error}</p>
            )}

            <button
              type="submit"
              className="w-full h-12 rounded-xl bg-gradient-to-r from-red-600 to-red-800 hover:opacity-90 text-white font-bold transition-all mt-4 uppercase tracking-widest shadow-[0_4px_20px_rgba(239,68,68,0.3)]"
            >
              Autenticar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
