-- DESHABILITAR RLS COMPLETAMENTE
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Verificar
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';

