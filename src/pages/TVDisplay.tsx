import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Rodada } from '../types';
import { Lock, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function TVDisplay() {
  const [authorized, setAuthorized] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  
  const [activeRodada, setActiveRodada] = useState<Rodada | null>(null);
  const lastBallRef = useRef<number | null>(null);

  const handleLogin = async (e?: any, pinOverride?: string) => {
    if (e) e.preventDefault();
    try {
      const { data } = await supabase!.from('admin_config').select('valor').eq('chave', 'tv_pin').single();
      
      const inputPin = (pinOverride || pin).trim();
      const dbPin = data?.valor?.trim();

      if ((data && dbPin === inputPin) || inputPin === '0508') {
        setAuthorized(true);
      } else {
        setError('PIN Incorreto');
      }
    } catch (err) {
      console.error(err);
      if ((pinOverride || pin).trim() === '0508') {
        setAuthorized(true);
      } else {
        setError('PIN Incorreto ou erro no banco');
      }
    }
  };

  useEffect(() => {
    if (!authorized) return;
    
    fetchActiveRodada();
    
    const sub = supabase?.channel('tv_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rodadas' }, (payload) => {
        const updated = payload.new as Rodada;
        setActiveRodada(updated);
        
        // Check for new ball and speak
        if (updated.bolas_sorteadas && updated.bolas_sorteadas.length > 0 && updated.status !== 'finalizada') {
          const lastBall = updated.bolas_sorteadas[updated.bolas_sorteadas.length - 1];
          if (lastBall !== lastBallRef.current) {
            lastBallRef.current = lastBall;
            speak(`Bola número ${lastBall}`);
          }
        }

        if (updated.status === 'finalizada' && updated.ganhador_cartela_cheia) {
            import('canvas-confetti').then((confetti) => {
                confetti.default({
                    particleCount: 500,
                    spread: 360,
                    origin: { y: 0.5 },
                    colors: ['#EAB308', '#F59E0B', '#D97706', '#DC2626']
                });
                speak('Bingo! Temos um vencedor!');
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1047/1047-preview.mp3');
                audio.play().catch(e => console.error('Audio play failed', e));
            });
        }
      }).subscribe();

    return () => {
      sub?.unsubscribe();
    };
  }, [authorized]);

  const fetchActiveRodada = async () => {
    const { data } = await supabase!
      .from('rodadas')
      .select('*')
      .in('status', ['aberta', 'em_andamento'])
      .order('id', { ascending: false })
      .limit(1)
      .single();
    
    if (data) {
       setActiveRodada(data);
       if (data.bolas_sorteadas && data.bolas_sorteadas.length > 0) {
           lastBallRef.current = data.bolas_sorteadas[data.bolas_sorteadas.length - 1];
       }
    } else {
       setActiveRodada(null);
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!authorized) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <Lock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white">TV - Cassino Pier</h1>
          </div>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full text-center tracking-[1em] text-2xl py-4 bg-neutral-950 border border-neutral-800 rounded-xl text-amber-500 font-bold focus:ring-2 focus:ring-amber-500 outline-none mb-4"
            placeholder="PIN"
            maxLength={4}
          />
          {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}
          <button type="submit" className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-lg transition-colors">
            Acessar Painel
          </button>
          <div className="mt-4 border-t border-neutral-800 pt-4">
            <button
              type="button"
              onClick={() => handleLogin(undefined, '0508')}
              className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 font-bold text-sm transition-colors uppercase tracking-widest"
            >
              Acesso Rápido (Somente Tela LG WebOS)
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (!activeRodada) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-24 h-24 text-amber-500/20 mx-auto mb-6 animate-pulse" />
          <h1 className="text-4xl font-bold text-neutral-500 uppercase tracking-[0.2em]">Aguardando Rodada</h1>
        </div>
      </div>
    );
  }

  const lastBall = activeRodada.bolas_sorteadas[activeRodada.bolas_sorteadas.length - 1];
  const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);

  return (
    <div className="flex-1 text-white overflow-hidden flex flex-col relative z-10">
      {/* Header Info */}
      <header className="h-20 bg-black/60 backdrop-blur-md border-b border-yellow-600/30 flex items-center justify-between px-8 shadow-2xl relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.4)]">
            <span className="text-black font-bold text-xl">P</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-200 uppercase">Cassino Pier do Costa</h1>
            <p className="text-[10px] text-yellow-500/80 uppercase tracking-[0.2em] font-semibold">Luxury Bingo Experience</p>
          </div>
        </div>
        
        <div className="flex gap-8 items-center">
          <div className="text-right">
             <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Prêmio 1ª Linha</p>
             <p className="text-xl font-mono font-bold text-yellow-500">R$ {activeRodada.premio_linha_1.toFixed(2)}</p>
          </div>
          <div className="h-8 w-px bg-yellow-600/30"></div>
          <div className="text-right">
             <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Prêmio 2ª Linha</p>
             <p className="text-xl font-mono font-bold text-yellow-500">R$ {activeRodada.premio_linha_2.toFixed(2)}</p>
          </div>
          <div className="h-8 w-px bg-yellow-600/30"></div>
          <div className="text-right bg-white/5 border border-yellow-500/30 px-4 py-2 rounded-lg">
             <p className="text-yellow-500 uppercase tracking-widest text-[10px] font-bold mb-1">Cartela Cheia</p>
             <p className="text-3xl font-mono font-bold text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">
               R$ {activeRodada.premio_cartela_cheia.toFixed(2)}
             </p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex p-6 gap-6 relative">
        {/* Giant Last Ball Container */}
        <div className="flex-1 bg-gradient-to-b from-gray-900 to-black rounded-[2rem] border border-yellow-600/20 shadow-2xl relative flex flex-col items-center justify-center">
          <div className="absolute top-6 left-6 text-xs text-yellow-500 font-bold tracking-widest bg-yellow-950/40 px-3 py-1 rounded-full border border-yellow-600/30 uppercase flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            LIVE DRAW
          </div>
          <AnimatePresence mode="wait">
            {lastBall ? (
              <div className="flex flex-col items-center justify-center w-full h-full">
                <motion.div
                  key={lastBall}
                  initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
                  className="flex items-center justify-center relative"
                >
                  <span className="text-[20rem] font-black text-yellow-400 drop-shadow-[0_0_50px_rgba(234,179,8,1)] leading-none select-none">
                    {lastBall}
                  </span>
                </motion.div>
              </div>
            ) : (
              <div className="text-center text-gray-600 font-bold text-3xl uppercase tracking-widest">
                Aguardando Sorteio
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Numbers Grid */}
        <div className="w-[45%] bg-black/40 border border-white/10 rounded-[2rem] p-6 backdrop-blur-md flex flex-col">
          <h2 className="text-xs font-bold text-yellow-500/70 uppercase tracking-[0.2em] mb-4">Painel de Sorteio</h2>
          <div className="grid grid-cols-10 gap-2 content-start flex-1">
            {allNumbers.map(num => {
              const drawn = activeRodada.bolas_sorteadas.includes(num);
              const isLast = num === lastBall;
              return (
                <div 
                  key={num}
                  className={cn(
                    "aspect-square rounded flex items-center justify-center text-lg font-bold transition-all duration-500",
                    isLast ? "bg-white text-black scale-110 shadow-[0_0_20px_rgba(255,255,255,0.8)] z-10 ring-2 ring-yellow-500" :
                    drawn ? "bg-yellow-500 text-black shadow-sm" :
                    "bg-white/10 text-gray-500 text-sm"
                  )}
                >
                  {num}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {activeRodada.status === 'finalizada' && activeRodada.ganhador_cartela_cheia && (
        <div className="absolute inset-0 bg-yellow-600/90 backdrop-blur-md z-50 flex items-center justify-center animate-pulse">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-red-700 rounded-3xl p-16 text-center text-white max-w-6xl w-full border-[12px] border-yellow-400 shadow-[0_0_150px_rgba(234,179,8,1)]"
          >
            <h1 className="text-9xl font-black uppercase mb-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">BINGOOO!</h1>
            <p className="text-6xl font-black uppercase tracking-widest text-yellow-300 drop-shadow-lg mb-8">
               VENCEDOR: <br/><span className="text-white text-7xl mt-4 block">{activeRodada.nome_vencedor}</span>
            </p>
            <p className="text-5xl mt-8 font-mono bg-black/30 py-6 px-12 rounded-2xl inline-block border-4 border-yellow-400 text-yellow-400 font-bold drop-shadow-md">
               Prêmio: R$ {activeRodada.premio_cartela_cheia.toFixed(2)}
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
