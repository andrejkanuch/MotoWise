SELECT
    verdict,
    screen,
    feature_area,
    route_keys,
    count() AS events,
    uniq(pid) AS people
FROM (
    SELECT
        toString(properties.$screen_name) AS screen,
        toString(properties.feature_area) AS feature_area,
        arrayFilter(k -> startsWith(k, 'route_'), JSONExtractKeys(properties)) AS route_keys,
        person_id AS pid,
        multiIf(
            match(screen, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'), 'FAIL uuid in name',
            match(screen, '/(t|rider|article|ride|trip|routes|bike|document|route)/[^\\[/(]') AND NOT match(screen, '/rider/followers$'), 'FAIL raw value after dynamic parent',
            arrayExists(seg -> length(seg) >= 16 AND match(seg, '[0-9]') AND NOT startsWith(seg, '['), splitByChar('/', screen)), 'FAIL token-like segment',
            NOT startsWith(screen, '/'), 'FAIL not a path',
            hasAny(route_keys, ['route_token', 'route_username']), 'FAIL forbidden route param',
            arrayExists(k -> k NOT IN ('route_id', 'route_slug', 'route_country', 'route_region'), route_keys), 'FAIL unlisted route param',
            feature_area IS NULL OR feature_area IN ('', 'null'), 'FAIL feature_area missing',
            'ok'
        ) AS verdict
    FROM events
    WHERE event = '$screen'
      AND properties.$app_version = '3.21.0'
      AND timestamp > now() - INTERVAL 30 DAY
)
GROUP BY verdict, screen, feature_area, route_keys
ORDER BY verdict = 'ok', events DESC
