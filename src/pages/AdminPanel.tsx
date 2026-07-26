import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Customer, Rodada, Cartela } from '../types';
import { Play, Square, Dices, LogOut, CheckCircle2, UserX, QrCode } from 'lucide-react';
import { cn } from '../lib/utils';
import QRCode from 'react-qr-code';

export default function AdminPanel() {
  const navigate = useNavigate();
  const [activeRodada, setActiveRodada] = useState<Rodada | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);

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

    // Check for Cartela Cheia winner
    const currentCartelas = cartelas.filter(c => c.rodada_id === activeRodada.id);
    let cartelaCheiaWinnerId = null;

    for (const c of currentCartelas) {
      let missing = 0;
      for (const row of c.numeros_json) {
        for (const num of row) {
          if (num !== 0 && !newBolas.includes(num)) {
            missing++;
          }
        }
      }
      if (missing === 0) {
        cartelaCheiaWinnerId = c.customer_id;
        break;
      }
    }

    if (cartelaCheiaWinnerId && !activeRodada.ganhador_cartela_cheia) {
       const customer = customers.find(c => c.id === cartelaCheiaWinnerId);
       if (customer) {
          await supabase!.from('rodadas').update({ 
             ganhador_cartela_cheia: customer.id,
             vencedor_id: customer.id,
             nome_vencedor: customer.nome_completo,
             status: 'finalizada' 
          }).eq('id', activeRodada.id);
          
          await supabase!.from('customers').update({ 
             saldo_carteira: customer.saldo_carteira + activeRodada.premio_cartela_cheia 
          }).eq('id', customer.id);
          
          alert(`BINGO! ${customer.nome_completo} bateu cartela cheia! Rodada encerrada. Inicie uma nova rodada.`);
       }
    }
  };

  const handleDeclareWinner = async (type: 'linha_1' | 'linha_2' | 'cartela_cheia', prizeAmount: number, customerId: number) => {
    if (!activeRodada) return;
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    if (confirm(`Pagar prêmio de R$ ${prizeAmount.toFixed(2)} para ${customer.nome_completo}? O valor será adicionado ao saldo do cliente.`)) {
      const updateData: any = { [`ganhador_${type}`]: customerId };
      if (type === 'cartela_cheia') {
        updateData.status = 'finalizada';
        updateData.vencedor_id = customer.id;
        updateData.nome_vencedor = customer.nome_completo;
      }
      
      await supabase!.from('rodadas').update(updateData).eq('id', activeRodada.id);
      await supabase!.from('customers').update({ saldo_carteira: customer.saldo_carteira + prizeAmount }).eq('id', customer.id);
      alert('Prêmio pago com sucesso!');
    }
  };

  const settleDebt = async (c: Customer) => {
    if (confirm(`Liquidar saldo de R$ ${c.saldo_carteira.toFixed(2)} de ${c.nome_completo}?`)) {
      await supabase!.from('customers').update({ saldo_carteira: 0 }).eq('id', c.id);
    }
  };

  const adjustBalance = async (c: Customer) => {
    const amountStr = prompt(`Ajustar Saldo (PIX, Dinheiro, etc) para ${c.nome_completo}:\n\nDigite o valor para adicionar (ex: 50.00) ou subtrair (ex: -50.00):`);
    if (!amountStr) return;
    const amount = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(amount)) {
      alert('Valor inválido');
      return;
    }
    await supabase!.from('customers').update({ saldo_carteira: c.saldo_carteira + amount }).eq('id', c.id);
  };

  return (
    <div className="flex-1 text-white">
      <header className="h-20 bg-black/60 backdrop-blur-md border-b border-yellow-600/30 px-8 flex items-center justify-between sticky top-0 z-50 shadow-2xl">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-200 uppercase">Painel do Caixa</h1>
          <p className="text-[10px] text-yellow-500/80 uppercase tracking-widest font-semibold">Cassino Pier do Costa</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowQR(true)} className="text-gray-400 hover:text-yellow-500 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-white/5 px-3 py-2 rounded-lg border border-white/10">
            <QrCode className="w-4 h-4" />
            Link da TV
          </button>
          <button onClick={() => { localStorage.removeItem('bingo_admin'); navigate('/admin'); }} className="text-gray-500 hover:text-red-500 transition-colors ml-2">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
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

                  <div className="flex flex-col gap-2 mt-2">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Pagar Premiações</p>
                    
                    {!activeRodada.ganhador_linha_1 && (
                      <div className="flex gap-2">
                        <select id="winner-l1" className="bg-black/60 border border-white/10 text-xs text-white rounded-lg px-2 py-2 flex-1 focus:outline-none">
                          <option value="">Ganhador 1ª Linha...</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.nome_completo}</option>)}
                        </select>
                        <button 
                          onClick={() => {
                            const select = document.getElementById('winner-l1') as HTMLSelectElement;
                            const cid = parseInt(select.value);
                            if (cid) handleDeclareWinner('linha_1', activeRodada.premio_linha_1, cid);
                          }}
                          className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-500 hover:text-black font-bold px-3 text-[10px] uppercase rounded-lg border border-emerald-600/30 transition-colors"
                        >Pagar</button>
                      </div>
                    )}
                    
                    {!activeRodada.ganhador_linha_2 && (
                      <div className="flex gap-2">
                        <select id="winner-l2" className="bg-black/60 border border-white/10 text-xs text-white rounded-lg px-2 py-2 flex-1 focus:outline-none">
                          <option value="">Ganhador 2ª Linha...</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.nome_completo}</option>)}
                        </select>
                        <button 
                          onClick={() => {
                            const select = document.getElementById('winner-l2') as HTMLSelectElement;
                            const cid = parseInt(select.value);
                            if (cid) handleDeclareWinner('linha_2', activeRodada.premio_linha_2, cid);
                          }}
                          className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-500 hover:text-black font-bold px-3 text-[10px] uppercase rounded-lg border border-emerald-600/30 transition-colors"
                        >Pagar</button>
                      </div>
                    )}
                    
                    {!activeRodada.ganhador_cartela_cheia && (
                      <div className="flex gap-2">
                        <select id="winner-cc" className="bg-black/60 border border-white/10 text-xs text-white rounded-lg px-2 py-2 flex-1 focus:outline-none">
                          <option value="">Cartela Cheia...</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.nome_completo}</option>)}
                        </select>
                        <button 
                          onClick={() => {
                            const select = document.getElementById('winner-cc') as HTMLSelectElement;
                            const cid = parseInt(select.value);
                            if (cid) handleDeclareWinner('cartela_cheia', activeRodada.premio_cartela_cheia, cid);
                          }}
                          className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-500 hover:text-black font-bold px-3 text-[10px] uppercase rounded-lg border border-emerald-600/30 transition-colors"
                        >Pagar</button>
                      </div>
                    )}
                  </div>

                  {activeRodada.status === 'aberta' && (
                    <button 
                      onClick={async () => {
                        if (confirm('Iniciar bingo e bloquear novas vendas de cartelas?')) {
                          await supabase!.from('rodadas').update({ status: 'em_andamento' }).eq('id', activeRodada.id);
                        }
                      }}
                      className="w-full py-3 mt-2 bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-500 font-bold rounded-xl border border-yellow-500/50 transition-colors uppercase tracking-widest text-xs"
                    >
                      Iniciar Bingo (Bloquear Compras)
                    </button>
                  )}

                  <button 
                    onClick={handleEndRodada}
                    className="w-full py-3 mt-2 bg-red-950/30 hover:bg-red-900/50 text-red-500 font-bold rounded-xl border border-red-500/20 transition-colors uppercase tracking-widest text-xs"
                  >
                    Encerrar Bingo
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
                <div key={c.id} className={cn(
                  "flex items-center justify-between p-3 rounded-xl border",
                  c.status_conta === 'solicitando_saque' ? "bg-red-950/40 border-red-500/50" : "bg-white/5 border-white/5"
                )}>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold uppercase flex items-center gap-2">
                      {c.nome_completo}
                      {c.status_conta === 'solicitando_saque' && (
                        <span className="bg-red-500 text-black text-[9px] px-1.5 py-0.5 rounded-full animate-pulse">SAQUE SOLICITADO</span>
                      )}
                    </span>
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
                    <div className="flex gap-2">
                      {c.status_conta === 'solicitando_saque' && (
                        <button 
                          onClick={async () => {
                            if (confirm(`Confirmar que o valor de R$ ${c.saldo_carteira.toFixed(2)} foi pago ao cliente?`)) {
                              await supabase!.from('customers').update({ saldo_carteira: 0, status_conta: 'ativo' }).eq('id', c.id);
                            }
                          }}
                          className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-black text-[10px] font-bold px-3 py-2 rounded uppercase tracking-widest transition-colors border border-red-600/30"
                        >
                          Valor Pago
                        </button>
                      )}
                      <button 
                        onClick={() => adjustBalance(c)}
                        className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-500 hover:text-black text-[10px] font-bold px-3 py-2 rounded uppercase tracking-widest transition-colors border border-emerald-600/30"
                      >
                        + Saldo
                      </button>
                      {c.saldo_carteira !== 0 && (
                        <button 
                          onClick={() => settleDebt(c)}
                          className="bg-yellow-600/20 hover:bg-yellow-600 text-yellow-500 hover:text-black text-[10px] font-bold px-3 py-2 rounded uppercase tracking-widest transition-colors border border-yellow-600/30"
                        >
                          Zerar
                        </button>
                      )}
                    </div>
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
      {activeRodada?.status === 'finalizada' && activeRodada?.ganhador_cartela_cheia && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-yellow-500/30 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl animate-in zoom-in duration-300">
            <h2 className="text-3xl font-black text-yellow-500 uppercase mb-2">Temos um vencedor!</h2>
            <p className="text-white text-xl mb-4 font-bold">{activeRodada.nome_vencedor}</p>
            <p className="text-sm text-gray-400 uppercase tracking-widest mb-6">
              Prêmio Principal: <br/>
              <span className="text-2xl text-emerald-400 font-mono mt-2 block">R$ {activeRodada.premio_cartela_cheia.toFixed(2)}</span>
            </p>
            <button 
              onClick={() => setActiveRodada(null)}
              className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-bold uppercase tracking-widest rounded-xl transition-colors"
            >
              Arquivar e Fechar
            </button>
          </div>
        </div>
      )}
      {showQR && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-300">
            <h2 className="text-xl font-bold text-white uppercase tracking-widest mb-2">Acesso à TV</h2>
            <p className="text-sm text-gray-400 mb-6">Escaneie o QR Code abaixo com a câmera do celular ou tablet para abrir a tela da TV.</p>
            
            <div className="bg-white p-4 rounded-2xl mx-auto w-fit mb-6">
              <QRCode value={`${window.location.origin}/tv`} size={200} />
            </div>

            <div className="bg-black/50 rounded-xl p-3 mb-6 break-all border border-white/5">
              <p className="text-xs text-gray-500 font-mono select-all">
                {`${window.location.origin}/tv`}
              </p>
            </div>
            
            <button 
              onClick={() => setShowQR(false)}
              className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-widest rounded-xl transition-colors border border-white/10"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
