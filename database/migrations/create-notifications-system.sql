-- ============================================================================
-- SISTEMA DE NOTIFICACIONES EN TIEMPO REAL
-- ============================================================================
-- Este script crea:
-- 1. Tabla de notificaciones
-- 2. Función para crear notificaciones
-- 3. Triggers automáticos para eventos clave
-- 4. RLS policies
-- ============================================================================

-- 1. TABLA DE NOTIFICACIONES
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Comentarios
COMMENT ON TABLE notifications IS 'Notificaciones en tiempo real para usuarios de la plataforma';
COMMENT ON COLUMN notifications.type IS 'Tipo de notificación: info, warning, success, error';
COMMENT ON COLUMN notifications.read IS 'Indica si la notificación ha sido leída por el usuario';
COMMENT ON COLUMN notifications.action_url IS 'URL opcional a la que redirigir cuando se hace clic en la notificación';

-- 2. FUNCIÓN PARA CREAR NOTIFICACIONES A TODOS LOS USUARIOS DE UNA EMPRESA
-- ============================================================================
CREATE OR REPLACE FUNCTION create_company_notification(
  p_company_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_action_url TEXT DEFAULT NULL,
  p_exclude_user_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Insertar una notificación para cada usuario activo de la empresa
  INSERT INTO notifications (company_id, user_id, type, title, message, action_url)
  SELECT
    p_company_id,
    id,
    p_type,
    p_title,
    p_message,
    p_action_url
  FROM profiles
  WHERE company_id = p_company_id
    AND is_active = TRUE
    AND (p_exclude_user_id IS NULL OR id != p_exclude_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_company_notification IS 'Crea una notificación para todos los usuarios activos de una empresa, opcionalmente excluyendo un usuario';

-- 3. TRIGGERS AUTOMÁTICOS PARA EVENTOS CLAVE
-- ============================================================================

-- 3.1. Notificar cuando se INVITA un nuevo usuario
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_user_invited()
RETURNS TRIGGER AS $$
DECLARE
  v_inviter_name TEXT;
BEGIN
  -- Solo notificar si el usuario está activo y tiene company_id
  IF NEW.is_active = TRUE AND NEW.company_id IS NOT NULL THEN
    -- Obtener el nombre del invitador (usuario que creó el registro)
    SELECT COALESCE(full_name, email) INTO v_inviter_name
    FROM profiles
    WHERE id = NEW.created_by
    LIMIT 1;

    -- Si no hay created_by, usar un nombre genérico
    IF v_inviter_name IS NULL THEN
      v_inviter_name := 'Un administrador';
    END IF;

    -- Crear notificación para todos los usuarios de la empresa excepto el nuevo usuario
    PERFORM create_company_notification(
      NEW.company_id,
      'info',
      'Nuevo usuario invitado',
      v_inviter_name || ' ha invitado a ' || COALESCE(NEW.full_name, NEW.email) || ' a unirse al equipo.',
      '/users',
      NEW.id  -- Excluir al nuevo usuario
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_user_invited ON profiles;
CREATE TRIGGER trigger_notify_user_invited
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_invited();

-- 3.2. Notificar cuando un NUEVO USUARIO hace su PRIMER INGRESO
-- ============================================================================
-- Detectamos el primer ingreso cuando updated_at cambia por primera vez después de created_at
CREATE OR REPLACE FUNCTION notify_user_first_login()
RETURNS TRIGGER AS $$
DECLARE
  v_is_first_login BOOLEAN;
BEGIN
  -- Verificar si es el primer login:
  -- 1. must_change_password cambió de TRUE a FALSE
  -- 2. O last_sign_in_at cambió de NULL a un valor (si agregamos esta columna)
  v_is_first_login := (OLD.must_change_password = TRUE AND NEW.must_change_password = FALSE);

  IF v_is_first_login AND NEW.company_id IS NOT NULL THEN
    -- Crear notificación para todos los usuarios de la empresa excepto el que ingresó
    PERFORM create_company_notification(
      NEW.company_id,
      'success',
      'Nuevo usuario activado',
      COALESCE(NEW.full_name, NEW.email) || ' ha completado su primer ingreso a la plataforma.',
      '/users',
      NEW.id  -- Excluir al usuario que ingresó
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_user_first_login ON profiles;
CREATE TRIGGER trigger_notify_user_first_login
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.must_change_password IS DISTINCT FROM NEW.must_change_password)
  EXECUTE FUNCTION notify_user_first_login();

-- 3.3. Notificar cuando se CREA una LICITACIÓN
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_licitacion_created()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_name TEXT;
BEGIN
  -- Obtener el nombre del creador
  SELECT COALESCE(full_name, email) INTO v_creator_name
  FROM profiles
  WHERE id = NEW.created_by
  LIMIT 1;

  IF v_creator_name IS NULL THEN
    v_creator_name := 'Un usuario';
  END IF;

  -- Crear notificación para todos los usuarios de la empresa
  PERFORM create_company_notification(
    NEW.company_id,
    'info',
    'Nueva licitación publicada',
    v_creator_name || ' ha publicado la licitación "' || NEW.title || '"' ||
    CASE
      WHEN NEW.deadline IS NOT NULL THEN ' con fecha límite ' || TO_CHAR(NEW.deadline, 'DD/MM/YYYY')
      ELSE ''
    END || '.',
    '/licitaciones/' || NEW.id,
    NEW.created_by  -- Excluir al creador
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_licitacion_created ON licitaciones;
CREATE TRIGGER trigger_notify_licitacion_created
  AFTER INSERT ON licitaciones
  FOR EACH ROW
  EXECUTE FUNCTION notify_licitacion_created();

-- 3.4. Notificar cuando se CREA un PROYECTO
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_project_created()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_name TEXT;
BEGIN
  -- Obtener el nombre del creador
  SELECT COALESCE(full_name, email) INTO v_creator_name
  FROM profiles
  WHERE id = NEW.created_by
  LIMIT 1;

  IF v_creator_name IS NULL THEN
    v_creator_name := 'Un usuario';
  END IF;

  -- Crear notificación para todos los usuarios de la empresa
  PERFORM create_company_notification(
    NEW.company_id,
    'info',
    'Nuevo proyecto creado',
    v_creator_name || ' ha creado el proyecto "' || NEW.name || '"' ||
    CASE
      WHEN NEW.end_date IS NOT NULL THEN ' con fecha de término ' || TO_CHAR(NEW.end_date, 'DD/MM/YYYY')
      ELSE ''
    END || '.',
    '/projects/' || NEW.id,
    NEW.created_by  -- Excluir al creador
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_project_created ON projects;
CREATE TRIGGER trigger_notify_project_created
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION notify_project_created();

-- 4. TRIGGER PARA ACTUALIZAR updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_notifications_updated_at ON notifications;
CREATE TRIGGER trigger_update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy para SELECT: Los usuarios solo pueden ver sus propias notificaciones
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Policy para UPDATE: Los usuarios solo pueden actualizar (marcar como leídas) sus propias notificaciones
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy para DELETE: Los usuarios pueden eliminar sus propias notificaciones
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- Policy para INSERT: Solo funciones del sistema pueden insertar notificaciones
-- (Los usuarios NO pueden crear notificaciones manualmente)
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (FALSE);  -- Nadie puede insertar directamente, solo triggers

-- 6. HABILITAR REALTIME PARA NOTIFICACIONES
-- ============================================================================
-- Nota: Esto debe ejecutarse también en el dashboard de Supabase:
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 7. FUNCIÓN PARA MARCAR NOTIFICACIÓN COMO LEÍDA
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_notification_as_read(p_notification_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET read = TRUE, updated_at = NOW()
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_notification_as_read IS 'Marca una notificación como leída';

-- 8. FUNCIÓN PARA MARCAR TODAS LAS NOTIFICACIONES COMO LEÍDAS
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_all_notifications_as_read()
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET read = TRUE, updated_at = NOW()
  WHERE user_id = auth.uid() AND read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_all_notifications_as_read IS 'Marca todas las notificaciones del usuario como leídas';

-- 9. FUNCIÓN PARA ELIMINAR NOTIFICACIÓN
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_notification(p_notification_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION delete_notification IS 'Elimina una notificación del usuario';

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
-- IMPORTANTE: Después de ejecutar este script, ir al Dashboard de Supabase:
-- 1. Database > Replication
-- 2. Habilitar "notifications" para Realtime
-- ============================================================================

