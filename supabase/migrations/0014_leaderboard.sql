-- 0014: leaderboard de países — suma de pasos de recorridos TERMINADOS por país.
create or replace function country_leaderboard(p_limit int default 10)
returns table(country text, steps bigint, tours bigint)
language sql stable security definer set search_path = public as $$
  select ps.country,
         round(sum(coalesce(e.distance_m, 0) * 1.3))::bigint as steps,
         count(*)::bigint as tours
  from play_sessions ps
  join experiences e on e.id = ps.experience_id
  where ps.status = 'TERMINADO' and ps.country is not null and ps.country <> ''
  group by ps.country
  order by steps desc
  limit greatest(1, least(p_limit, 50));
$$;

notify pgrst, 'reload schema';
