import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Customer, Rodada, Cartela } from '../types';
import { Play, Square, Dices, LogOut, CheckCircle2, UserX } from 'lucide-react';
import { cn } from '../lib/utils';

export default function AdminPanel() {
  const navigate = useNavigate();
  const [activeRodada, setActiveRodada] = useState<Rodada | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('bingo_admin')) {
      navigate('/admin');
      return;
    }
    fetchData();

    const sub = supabase?.channel('admin_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rodadas' }, () => fetchRodada())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchCustomers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cartelas' }, () => fetchCartelas())
      .subscribe();

    return () => {
      sub?.unsubscribe();
    };
  }, [navigate]);

  const fetchData = async () => {
    await Promise.all([fetchRodada(), fetchCustomers(), fetchCartelas()]);
  };

  const fetchRodada = async () => {
    const { data } = await supabase!
      .from('rodadas')
      .select('*')
      .in('status', ['aberta', 'em_andamento'])
      .order('id', { ascending: false })
      .limit(1)
      .single();
    setActiveRodada(data || null);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase!.from('customers').select('*').order('nome_completo');
    setCustomers(data || []);
  };

  const fetchCartelas = async () => {
    const { data } = await supabase!.from('cartelas').select('*');
    setCartelas(data || []);
  };

  const handleStartRodada = async () => {
    setLoading(true);
    await supabase!.from('rodadas').insert([{ status: 'aberta' }]);
    setLoading(false);
  };

  const handleEndRodada = async () => {
    if (!activeRodada) return;
    if (confirm('Encerrar rodada atual? (Premiação deve ser feita antes)')) {
      await supabase!.from('rodadas').update({ status: 'finalizada' }).eq('id', activeRodada.id);
    }
  };

  const drawBall = async () => {
    if (!activeRodada) return;
    
    // Auto change status to 'em_andamento' to block new cards
    if (activeRodada.status === 'aberta') {
       await supabase!.from('rodadas').update({ status: 'em_andamento' }).eq('id', activeRodada.id);
    }

    const possible = Array.from({ length: 75 }, (_, i) => i + 1).filter(n => !activeRodada.bolas_sorteadas.includes(n));
    if (possible.length === 0) return;

    const drawn = possible[Math.floor(Math.random() * possible.length)];
    const newBolas = [...activeRodada.bolas_sorteadas, drawn];

    await supabase!
      .from('rodadas')
      .update({ bolas_sorteadas: newBolas })
      .eq('id', activeRodada.id);
  };

  const settleDebt = async (c: Customer) => {
    if (confirm(`Liquidar saldo de R$ ${c.saldo_carteira.toFixed(2)} de ${c.nome_completo}?`)) {
      await supabase!.from('customers').update({ saldo_carteira: 0 }).eq('id', c.id);
    }
  };

  return (
    <div className="flex-1 text-white">
      <header className="h-20 bg-black/60 backdrop-blur-md border-b border-yellow-600/30 px-8 flex items-center justify-between sticky top-0 z-50 shadow-2xl">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-200 uppercase">Painel do Caixa</h1>
          <p className="text-[10px] text-yellow-500/80 uppercase tracking-widest font-semibold">Cassino Pier do Costa</p>
        </div>
        <button onClick={() => { localStorage.removeItem('bingo_admin'); navigate('/admin'); }} className="text-gray-500 hover:text-yellow-500 transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sorteio & Controle da Rodada */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
            <h2 className="text-xs font-bold text-yellow-500/70 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
              <Dices className="w-4 h-4" />
              Controle de Sorteio
            </h2>

            {!activeRodada ? (
              <button 
                onClick={handleStartRodada} disabled={loading}
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-700 h-12 rounded-xl font-bold text-black uppercase tracking-widest shadow-[0_4px_20px_rgba(212,175,55,0.3)] hover:opacity-90 transition-all"
              >
                Abrir Nova Rodada
              </button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Rodada Atual</p>
                    <p className="text-xl font-bold text-white">#{activeRodada.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Arrecadação</p>
                    <p className="text-xl font-bold text-emerald-400">R$ {activeRodada.arrecadacao_total.toFixed(2)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Prêmio 1ª Linha</p>
                    <p className="font-mono font-bold text-yellow-500">R$ {activeRodada.premio_linha_1.toFixed(2)}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Cartela Cheia</p>
                    <p className="font-mono font-bold text-yellow-500">R$ {activeRodada.premio_cartela_cheia.toFixed(2)}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
                  <button 
                    onClick={drawBall}
                    className="w-full bg-gradient-to-r from-yellow-500 to-yellow-700 h-14 rounded-xl font-bold text-black uppercase tracking-widest shadow-[0_4px_20px_rgba(212,175,55,0.3)] hover:opacity-90 transition-all active:scale-95"
                  >
                    SORTEAR BOLA
                  </button>
                  <button 
                    onClick={handleEndRodada}
                    className="w-full py-3 bg-red-950/30 hover:bg-red-900/50 text-red-500 font-bold rounded-xl border border-red-500/20 transition-colors uppercase tracking-widest text-xs"
                  >
                    Finalizar Rodada
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Gestão de Clientes / Caixa */}
        <div className="lg:col-span-2">
          <div className="bg-black/40 border border-white/10 rounded-2xl flex flex-col h-[calc(100vh-8rem)]">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xs font-bold text-yellow-500/70 uppercase tracking-[0.2em] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Gestão de Caixa & Clientes
              </h2>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {customers.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold uppercase">{c.nome_completo}</span>
                    <span className="text-[10px] text-gray-500 font-mono mt-0.5">{c.telefone}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] uppercase text-gray-500 font-bold">Saldo</p>
                      <span className={cn(
                        "text-xs font-bold font-mono",
                        c.saldo_carteira < 0 ? "text-red-400" : 
                        c.saldo_carteira > 0 ? "text-emerald-400" : 
                        "text-yellow-500/70"
                      )}>
                        R$ {c.saldo_carteira.toFixed(2)}
                      </span>
                    </div>
                    {c.saldo_carteira !== 0 && (
                      <button 
                        onClick={() => settleDebt(c)}
                        className="bg-yellow-600/20 hover:bg-yellow-600 text-yellow-500 hover:text-black text-xs font-bold px-4 py-2 rounded uppercase tracking-widest transition-colors border border-yellow-600/30"
                      >
                        Liquidar
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {customers.length === 0 && (
                <div className="p-8 text-center text-[10px] text-gray-500 uppercase tracking-widest">
                  Nenhum cliente no salão.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
