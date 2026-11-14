-- El portal ya crea perfiles con role = 'supplier'. El enum remoto aún no lo admite.
-- Se separa en su propia migración porque PostgreSQL no permite usar de forma segura
-- un valor nuevo del enum antes de confirmar la transacción que lo agrega.

alter type public.user_role add value if not exists 'supplier';
