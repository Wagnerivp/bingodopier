import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Customer, Rodada, Cartela } from '../types';
import { Wallet, LogOut, Plus, AlertCircle, CreditCard, Receipt, Sparkles } from 'lucide-react';
import { generateBingoCard, cn } from '../lib/utils';
import confetti from 'canvas-confetti';

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activeRodada, setActiveRodada] = useState<Rodada | null>(null);
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyAmount, setBuyAmount] = useState(1);
  const [isBuying, setIsBuying] = useState(false);
  const [precoCartela, setPrecoCartela] = useState(10);

  useEffect(() => {
    const stored = localStorage.getItem('bingo_customer');
    if (!stored) {
      navigate('/');
      return;
    }
    const parsedCustomer = JSON.parse(stored) as Customer;
    setCustomer(parsedCustomer);
    fetchData(parsedCustomer.id);

    // Subscriptions
    const subCustomer = supabase?.channel('customer_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `id=eq.${parsedCustomer.id}` }, (payload) => {
        setCustomer(payload.new as Customer);
        localStorage.setItem('bingo_customer', JSON.stringify(payload.new));
      }).subscribe();

    const subRodadas = supabase?.channel('rodadas_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rodadas' }, (payload) => {
        const updated = payload.new as Rodada;
        if (updated.status === 'aberta' || updated.status === 'em_andamento' || updated.status === 'finalizada') {
           setActiveRodada(updated);
           if (updated.status === 'finalizada' && updated.ganhador_cartela_cheia === parsedCustomer.id) {
               confetti({
                 particleCount: 150,
                 spread: 100,
                 origin: { y: 0.6 }
               });
           }
        } else {
           fetchActiveRodada();
        }
      }).subscribe();

    const subCartelas = supabase?.channel('cartelas_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cartelas', filter: `customer_id=eq.${parsedCustomer.id}` }, (payload) => {
        fetchCartelas(parsedCustomer.id);
      }).subscribe();

    return () => {
      subCustomer?.unsubscribe();
      subRodadas?.unsubscribe();
      subCartelas?.unsubscribe();
    };
  }, [navigate]);

  const fetchData = async (customerId: number) => {
    setLoading(true);
    await fetchActiveRodada();
    await fetchCartelas(customerId);
    
    // Fetch price config
    const { data: config } = await supabase!.from('admin_config').select('valor').eq('chave', 'preco_cartela').single();
    if (config) setPrecoCartela(parseFloat(config.valor));
    
    setLoading(false);
  };

  const fetchActiveRodada = async () => {
    const { data } = await supabase!
      .from('rodadas')
      .select('*')
      .in('status', ['aberta', 'em_andamento'])
      .order('id', { ascending: false })
      .limit(1)
      .single();
    setActiveRodada(data || null);
  };

  const fetchCartelas = async (customerId: number) => {
    const { data } = await supabase!
      .from('cartelas')
      .select('*')
      .eq('customer_id', customerId)
      .order('id', { ascending: false });
    setCartelas(data || []);
  };

  const handleBuy = async (method: 'pago' | 'fiado') => {
    if (!customer || !activeRodada) return;
    
    const currentCount = cartelas.filter(c => c.rodada_id === activeRodada.id).length;
    if (currentCount + buyAmount > 5) {
      alert(`Você já possui ${currentCount} cartela(s). O máximo permitido por rodada é 5.`);
      return;
    }

    const totalCost = precoCartela * buyAmount;
    
    if (method === 'pago' && customer.saldo_carteira < totalCost) {
      alert('Saldo insuficiente na carteira. Adicione saldo via PIX ou compre no Fiado.');
      return;
    }

    setIsBuying(true);

    try {
      const newCartelas = Array.from({ length: buyAmount }).map(() => ({
        customer_id: customer.id,
        rodada_id: activeRodada.id,
        numeros_json: generateBingoCard(),
        status_pagamento: method,
        preco: precoCartela
      }));

      await supabase!.from('cartelas').insert(newCartelas);
      
      // Both reduce balance (Fiado allows negative balance)
      await supabase!.from('customers').update({
        saldo_carteira: customer.saldo_carteira - totalCost
      }).eq('id', customer.id);
      
      confetti({
        particleCount: 50,
        spread: 60,
        colors: ['#fbbf24', '#f59e0b', '#d97706'],
        origin: { y: 0.8 }
      });

      setBuyAmount(1);
    } catch (error) {
      console.error(error);
      alert('Erro ao comprar cartelas');
    } finally {
      setIsBuying(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('bingo_customer');
    navigate('/');
  };

  if (!customer || loading) {
    return <div className="flex-1 flex items-center justify-center text-yellow-500 z-10 relative">Carregando salão...</div>;
  }

  const activeCartelas = cartelas.filter(c => c.rodada_id === activeRodada?.id);

  return (
    <div className="flex-1 flex flex-col pb-24 relative z-10 overflow-auto">
      {/* Header / Wallet */}
      <div className="bg-black/60 backdrop-blur-md border-b border-yellow-600/30 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-md mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.4)]">
              <UserAvatar name={customer.nome_completo} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Olá,</p>
              <p className="font-bold text-white truncate max-w-[120px]">{customer.nome_completo}</p>
            </div>
          </div>
          
          <button onClick={logout} className="p-2 text-gray-500 hover:text-yellow-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <div className="max-w-md mx-auto px-4 pb-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Wallet className="w-16 h-16 text-yellow-500" />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Saldo Digital</p>
            <h2 className={cn("text-3xl font-mono font-bold tracking-tight", customer.saldo_carteira < 0 ? "text-red-400" : "text-emerald-400")}>
              R$ {customer.saldo_carteira.toFixed(2)}
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              <div className="bg-black/40 border border-yellow-600/30 rounded-xl p-4">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">Adicionar Saldo (PIX)</p>
                <div className="flex flex-col gap-1 mb-3">
                  <span className="text-sm font-mono font-bold text-white">Chave Celular: 22992040941</span>
                  <span className="text-xs text-gray-400">Nome: Richard</span>
                </div>
                <a 
                  href={`https://wa.me/5522992040941?text=${encodeURIComponent(`Olá, fiz um PIX para adicionar saldo. Meu nome é ${customer.nome_completo}. Segue o comprovante:`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 bg-gradient-to-r from-emerald-500 to-emerald-700 hover:opacity-90 rounded-lg text-xs font-bold text-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  Enviar Comprovante
                </a>
              </div>
              <button 
                onClick={async () => {
                  if (confirm('Deseja solicitar o resgate do seu saldo e fechar a conta? O caixa será notificado.')) {
                    await supabase!.from('customers').update({ status_conta: 'solicitando_saque' }).eq('id', customer.id);
                    alert('Solicitação enviada ao caixa! Aguarde o pagamento.');
                  }
                }}
                className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white transition-colors flex items-center justify-center gap-2 border border-white/10 uppercase tracking-widest"
              >
                <LogOut className="w-4 h-4 text-yellow-500" />
                Fechar Conta / Retirar Saldo
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6 w-full">
        {/* Active Round Status */}
        <section>
          {activeRodada ? (
            <div className="bg-black/40 border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Rodada #{activeRodada.id}
                    {activeRodada.status === 'em_andamento' && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-yellow-500/80 uppercase font-bold tracking-widest mt-1">
                    {activeRodada.status === 'aberta' ? 'Aguardando Sorteio' : 'Sorteio em Andamento'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Prêmio Máximo</p>
                  <p className="font-mono font-bold text-yellow-400">R$ {activeRodada.premio_cartela_cheia.toFixed(2)}</p>
                </div>
              </div>

              {activeRodada.status === 'aberta' ? (
                <div className="mt-4 pt-4 border-t border-white/10">
                  {activeCartelas.length >= 5 ? (
                    <div className="text-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                      <p className="text-xs text-yellow-500 font-bold uppercase tracking-widest">Limite Atingido</p>
                      <p className="text-[10px] text-gray-400 mt-1">Você já comprou o máximo de 5 cartelas.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-300 mb-3 font-bold uppercase tracking-widest">Comprar Cartelas <span className="text-yellow-500 font-mono">(R$ {precoCartela.toFixed(2)})</span></p>
                      <div className="flex gap-3 items-center mb-4">
                        <button 
                          onClick={() => setBuyAmount(Math.max(1, buyAmount - 1))}
                          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-bold"
                        >-</button>
                        <div className="flex-1 text-center font-bold text-xl">{buyAmount}</div>
                        <button 
                          onClick={() => setBuyAmount(Math.min(5 - activeCartelas.length, buyAmount + 1))}
                          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-bold"
                        >+</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          disabled={isBuying}
                          onClick={() => handleBuy('pago')}
                          className="py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:opacity-90 text-black font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Wallet className="w-4 h-4" /> Usar Saldo
                        </button>
                        <button 
                          disabled={isBuying}
                          onClick={() => handleBuy('fiado')}
                          className="py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-700 hover:opacity-90 text-black font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" /> Fiado
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : activeRodada.status === 'em_andamento' ? (
                <div className="mt-4">
                  <div className="p-3 mb-4 bg-red-950/30 border border-red-500/20 rounded-xl text-center text-[10px] uppercase font-bold tracking-widest text-red-400">
                    Sorteio iniciado. Compras bloqueadas.
                  </div>
                  <div className="pt-4 border-t border-white/10">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Bolas Sorteadas ({activeRodada.bolas_sorteadas?.length || 0})</h4>
                    <div className="flex flex-wrap gap-2">
                      {activeRodada.bolas_sorteadas?.map((bola, index) => (
                        <div key={index} className="w-8 h-8 rounded-full bg-yellow-500 text-black font-bold flex items-center justify-center text-sm shadow-[0_0_10px_rgba(234,179,8,0.4)] animate-in zoom-in">
                          {bola}
                        </div>
                      ))}
                      {(!activeRodada.bolas_sorteadas || activeRodada.bolas_sorteadas.length === 0) && (
                        <p className="text-xs text-gray-500">Aguardando o primeiro número...</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-center">
                  <h4 className="text-emerald-400 font-bold uppercase tracking-widest text-xs mb-1">Rodada Finalizada</h4>
                  {activeRodada.ganhador_cartela_cheia === customer.id ? (
                    <p className="text-white font-bold">🎉 BINGO! VOCÊ BATEU CARTELA CHEIA! 🎉</p>
                  ) : (
                    <p className="text-gray-400 text-xs mt-2">
                       Rodada Encerrada! Vencedor: <span className="text-white font-bold">{activeRodada.nome_vencedor}</span>.<br/> 
                       Prepare-se para a próxima!
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 text-center shadow-lg backdrop-blur-md">
              <AlertCircle className="w-8 h-8 text-gray-500 mx-auto mb-3" />
              <h3 className="text-white font-bold uppercase tracking-widest text-sm">Nenhuma rodada ativa</h3>
              <p className="text-xs text-gray-400 mt-2">Aguarde o caixa abrir uma nova rodada.</p>
            </div>
          )}
        </section>

        {/* My Cards */}
        <section>
          <h3 className="text-xs font-bold text-yellow-500/70 uppercase tracking-[0.2em] mb-4">Minhas Cartelas ({activeCartelas.length})</h3>
          <div className="space-y-4">
            {activeCartelas.map((cartela) => (
              <div key={cartela.id} className="bg-black/40 border border-white/10 rounded-2xl p-1 overflow-hidden shadow-xl backdrop-blur-md">
                <div className="bg-white/5 px-4 py-2 flex justify-between items-center border-b border-white/10">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cartela #{cartela.id}</span>
                  <span className={cn(
                    "text-[10px] uppercase font-bold px-2 py-1 rounded-full",
                    cartela.status_pagamento === 'pago' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                    cartela.status_pagamento === 'fiado' ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
                    "bg-white/5 text-gray-400"
                  )}>
                    {cartela.status_pagamento}
                  </span>
                </div>
                <div className="p-2">
                  <div className="grid grid-cols-5 gap-1 text-center mb-1">
                    {['B', 'I', 'N', 'G', 'O'].map((l) => (
                      <div key={l} className="text-yellow-500 font-black text-sm">{l}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {cartela.numeros_json.map((row, rIdx) => 
                      row.map((num, cIdx) => {
                        const isMarked = activeRodada?.bolas_sorteadas.includes(num);
                        const isFree = num === 0;
                        return (
                          <div 
                            key={`${rIdx}-${cIdx}`}
                            className={cn(
                              "aspect-square flex items-center justify-center rounded-lg text-sm md:text-base font-bold transition-all",
                              isFree ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                              isMarked ? "bg-yellow-500 text-black scale-[1.02] shadow-[0_0_15px_rgba(234,179,8,0.4)]" :
                              "bg-white/5 text-white"
                            )}
                          >
                            {isFree ? <Sparkles className="w-4 h-4" /> : num}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {activeCartelas.length === 0 && (
              <div className="text-center text-[10px] uppercase font-bold tracking-widest text-gray-500 py-8">
                Você ainda não tem cartelas nesta rodada.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function UserAvatar({ name }: { name: string }) {
  const init = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return <span className="text-black font-bold text-sm tracking-widest">{init}</span>;
}
