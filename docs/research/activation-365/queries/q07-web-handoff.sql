-- Web pageviews by page area + store CTA, 2026-08-14..11-10, India and TikTok crawler excluded. Run 2026-11-12.
SELECT event, multiIf(event = '$pageview', multiIf(properties.$pathname LIKE '%/get%', '/get', properties.$pathname LIKE '%/welcome%', '/welcome',
  properties.$pathname LIKE '%/blog/%', 'blog', properties.$pathname LIKE '%/maintenance%' OR properties.$pathname LIKE '%/bikes/%' OR properties.$pathname LIKE '%/motorcycles/%', 'bike/maintenance pages',
  properties.$pathname LIKE '%/trips%' OR properties.$pathname LIKE '%/routes%' OR properties.$pathname LIKE '%/explore%', 'trips/routes', 'home/other'), '') AS area,
  count() AS events, uniq(person_id) AS people
FROM events WHERE timestamp >= '2026-08-14' AND timestamp < '2026-11-11' AND properties.$lib = 'web'
  AND event IN ('$pageview','store_cta_click','open_in_app_clicked','get_link_opened','hero_viewed','checkout_initiated')
  AND properties.$geoip_country_code != 'IN' AND coalesce(properties.$raw_user_agent, '') NOT ILIKE '%aweme%'
GROUP BY event, area ORDER BY people DESC LIMIT 40
