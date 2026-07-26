import { Database, AlertCircle } from 'lucide-react';

export default function Setup() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center justify-center w-16 h-16 bg-amber-500/10 rounded-full mx-auto mb-6 border border-amber-500/20">
          <Database className="w-8 h-8 text-amber-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-center text-white mb-2">
          Configuração Necessária
        </h1>
        
        <p className="text-neutral-400 text-center mb-8">
          O Cassino Pier do Costa requer conexão com o Supabase para funcionar.
        </p>

        <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-4 mb-8">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="text-sm text-amber-200/80">
              <p className="mb-2 font-medium text-amber-400">Variáveis de Ambiente Ausentes</p>
              <p>Adicione as seguintes variáveis no seu arquivo <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-300">.env</code> ou nas configurações do painel:</p>
              <ul className="list-disc pl-4 mt-2 space-y-1 font-mono text-xs opacity-80">
                <li>VITE_SUPABASE_URL</li>
                <li>VITE_SUPABASE_ANON_KEY</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="text-sm text-neutral-500 text-center">
          Após configurar, reinicie o servidor de desenvolvimento.
        </div>
      </div>
    </div>
  );
}
