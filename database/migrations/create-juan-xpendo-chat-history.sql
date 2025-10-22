-- ============================================================================
-- JUAN XPENDO - CHAT HISTORY
-- ============================================================================
-- Este script crea la tabla para almacenar el historial de conversaciones
-- con Juan Xpendo (asistente de IA de Strategic Sourcing)
-- ============================================================================

-- 1. TABLA CHAT_HISTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC);

-- Comentarios
COMMENT ON TABLE chat_history IS 'Historial de conversaciones con Juan Xpendo (asistente de IA)';
COMMENT ON COLUMN chat_history.user_message IS 'Mensaje enviado por el usuario';
COMMENT ON COLUMN chat_history.assistant_message IS 'Respuesta generada por Juan Xpendo';

-- 2. ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Policy para SELECT (usuarios solo ven su propio historial)
DROP POLICY IF EXISTS "Users can view their own chat history" ON chat_history;
CREATE POLICY "Users can view their own chat history"
  ON chat_history FOR SELECT
  USING (user_id = auth.uid());

-- Policy para INSERT (usuarios solo pueden insertar en su propio historial)
DROP POLICY IF EXISTS "Users can insert their own chat history" ON chat_history;
CREATE POLICY "Users can insert their own chat history"
  ON chat_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy para DELETE (usuarios pueden borrar su historial)
DROP POLICY IF EXISTS "Users can delete their own chat history" ON chat_history;
CREATE POLICY "Users can delete their own chat history"
  ON chat_history FOR DELETE
  USING (user_id = auth.uid());

-- 3. FUNCIÓN PARA LIMPIAR HISTORIAL ANTIGUO (opcional)
-- ============================================================================
-- Esta función elimina el historial de chat mayor a 30 días
-- Puedes ejecutarla manualmente o configurar un cron job en Supabase

CREATE OR REPLACE FUNCTION cleanup_old_chat_history()
RETURNS void AS $$
BEGIN
  DELETE FROM chat_history
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_chat_history IS 'Elimina el historial de chat mayor a 30 días';

-- ============================================================================
-- FINALIZADO
-- ============================================================================
-- ✅ Tabla chat_history creada
-- ✅ RLS habilitado
-- ✅ Índices creados
-- ✅ Función de limpieza disponible
--
-- PRÓXIMOS PASOS:
-- 1. Copia y pega este script en Supabase SQL Editor
-- 2. Ejecuta el script
-- 3. Configura la API key de Groq en .env.local
-- ============================================================================

