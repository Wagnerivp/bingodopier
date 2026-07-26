CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Limpar tabelas se existirem (CUIDADO EM PRODUÇÃO)
-- DROP TABLE IF EXISTS cartelas CASCADE;
-- DROP TABLE IF EXISTS rodadas CASCADE;
-- DROP TABLE IF EXISTS customers CASCADE;
-- DROP TABLE IF EXISTS admin_config CASCADE;

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    nome_completo VARCHAR(150) NOT NULL,
    telefone VARCHAR(20) UNIQUE NOT NULL,
    saldo_carteira NUMERIC(10, 2) DEFAULT 0.00,
    status_conta VARCHAR(20) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rodadas (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'aberta', -- aberta, em_andamento, finalizada
    bolas_sorteadas INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    arrecadacao_total NUMERIC(10, 2) DEFAULT 0.00,
    premio_linha_1 NUMERIC(10, 2) GENERATED ALWAYS AS (arrecadacao_total * 0.10) STORED,
    premio_linha_2 NUMERIC(10, 2) GENERATED ALWAYS AS (arrecadacao_total * 0.20) STORED,
    premio_cartela_cheia NUMERIC(10, 2) GENERATED ALWAYS AS (arrecadacao_total * 0.60) STORED,
    lucro_bar NUMERIC(10, 2) GENERATED ALWAYS AS (arrecadacao_total * 0.10) STORED,
    ganhador_linha_1 INTEGER REFERENCES customers(id),
    ganhador_linha_2 INTEGER REFERENCES customers(id),
    ganhador_cartela_cheia INTEGER REFERENCES customers(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cartelas (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    rodada_id INTEGER REFERENCES rodadas(id) ON DELETE CASCADE,
    numeros_json JSONB NOT NULL,
    marcadas_json JSONB DEFAULT '[]'::JSONB,
    status_pagamento VARCHAR(20) DEFAULT 'pendente', -- pendente, pago, fiado
    preco NUMERIC(10, 2) DEFAULT 10.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_config (
    id SERIAL PRIMARY KEY,
    chave VARCHAR(50) UNIQUE NOT NULL,
    valor TEXT NOT NULL
);

INSERT INTO admin_config (chave, valor) VALUES 
('tv_pin', '0508'),
('admin_telefone', '22992040941'),
('admin_senha', '0508'),
('preco_cartela', '10.00')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

-- Configurar o Realtime
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

ALTER PUBLICATION supabase_realtime ADD TABLE rodadas;
ALTER PUBLICATION supabase_realtime ADD TABLE cartelas;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE admin_config;

-- Triggers para atualização automática de arrecadação da rodada
CREATE OR REPLACE FUNCTION update_arrecadacao_rodada()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE rodadas
    SET arrecadacao_total = (
        SELECT COALESCE(SUM(preco), 0)
        FROM cartelas
        WHERE rodada_id = NEW.rodada_id
    )
    WHERE id = NEW.rodada_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_arrecadacao
AFTER INSERT OR UPDATE ON cartelas
FOR EACH ROW
EXECUTE FUNCTION update_arrecadacao_rodada();
