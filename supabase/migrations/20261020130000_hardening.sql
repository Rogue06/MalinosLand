-- Les fonctions de déclencheur (limites anti-abus) n'ont pas à être appelées par l'API.
-- Les déclencheurs continuent de fonctionner (le droit EXECUTE n'est pas vérifié pour eux).
revoke execute on function public.reports_rate_limit() from public, anon, authenticated;
revoke execute on function public.feedback_rate_limit() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
