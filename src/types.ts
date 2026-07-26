export type Customer = {
  id: number;
  nome_completo: string;
  telefone: string;
  saldo_carteira: number;
  status_conta: 'ativo' | 'inativo';
  created_at: string;
};

export type Rodada = {
  id: number;
  status: 'aberta' | 'em_andamento' | 'finalizada';
  bolas_sorteadas: number[];
  arrecadacao_total: number;
  premio_linha_1: number;
  premio_linha_2: number;
  premio_cartela_cheia: number;
  lucro_bar: number;
  ganhador_linha_1: number | null;
  ganhador_linha_2: number | null;
  ganhador_cartela_cheia: number | null;
  vencedor_id: number | null;
  nome_vencedor: string | null;
  created_at: string;
};

export type Cartela = {
  id: number;
  customer_id: number;
  rodada_id: number;
  numeros_json: number[][]; // 5x5 grid
  marcadas_json: number[]; // Array of marked numbers
  status_pagamento: 'pendente' | 'pago' | 'fiado';
  preco: number;
  created_at: string;
};

export type Database = any;
