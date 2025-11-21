-- Corrigir search_path nas funções para evitar ambiguidade e melhorar segurança

-- 1. Recriar função de normalização com search_path
CREATE OR REPLACE FUNCTION normalize_text(text) 
RETURNS TEXT 
LANGUAGE SQL 
IMMUTABLE 
STRICT
SET search_path = public
AS $$
  SELECT lower(unaccent(trim($1)));
$$;

-- 2. Recriar função de updated_at com search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;