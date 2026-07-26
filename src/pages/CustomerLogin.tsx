import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Sparkles, Phone, User, Loader2 } from 'lucide-react';

export default function CustomerLogin() {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!supabase) throw new Error('Supabase not configured');

      // Check if user exists
      let { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .eq('telefone', telefone)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // If not exists, create
      if (!customer) {
        const { data: newCustomer, error: insertError } = await supabase
          .from('customers')
          .insert([{ nome_completo: nome, telefone }])
          .select()
          .single();
        
        if (insertError) throw insertError;
        customer = newCustomer;
      } else {
        // Optionally update name if they type a different one? 
        // We'll keep it simple and just use the fetched customer.
      }

      // Save to localStorage for simple auth simulation
      localStorage.setItem('bingo_customer', JSON.stringify(customer));
      navigate('/dashboard');

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-yellow-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-2xl shadow-[0_0_15px_rgba(212,175,55,0.4)] mb-6">
            <span className="text-black font-bold text-3xl">P</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-200 uppercase">Cassino Pier do Costa</h1>
          <p className="text-[10px] text-yellow-500/80 tracking-[0.2em] uppercase font-semibold mt-2">Luxury Bingo Experience</p>
        </div>

        <form onSubmit={handleLogin} className="bg-black/60 backdrop-blur-md border border-yellow-600/30 rounded-3xl p-8 shadow-2xl">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Nome Completo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                  placeholder="Seu nome"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Telefone (WhatsApp)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="tel"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 flex items-center justify-center border border-transparent rounded-xl shadow-[0_4px_20px_rgba(212,175,55,0.3)] text-sm font-bold text-black bg-gradient-to-r from-yellow-500 to-yellow-700 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 focus:ring-offset-black transition-all disabled:opacity-50 uppercase tracking-widest mt-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar no Salão'}
            </button>
          </div>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => navigate('/admin')}
            className="text-xs text-gray-500 hover:text-yellow-500 transition-colors uppercase tracking-widest font-semibold"
          >
            Acesso Restrito (Caixa)
          </button>
        </div>
      </div>
    </div>
  );
}
