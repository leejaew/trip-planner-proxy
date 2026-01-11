export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const USER_AGENT =
      env.USER_AGENT || "TripPlannerProxy/1.0";
    const CONTACT_EMAIL = env.CONTACT_EMAIL || "";
    const REFERER = env.REFERER || `https://${url.host}/`;

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });

    async function fetchJsonOrExplain(upstreamUrl, headers) {
      const r = await fetch(upstreamUrl, { headers });
      const ct = r.headers.get("content-type") || "";
      const text = await r.text();

      // If upstream is not OK, or not JSON, return a JSON error payload (never HTML)
      if (!r.ok || !ct.includes("application/json")) {
        return {
          ok: false,
          status: r.status,
          contentType: ct,
          bodySnippet: text.slice(0, 600),
        };
      }

      try {
        return { ok: true, status: r.status, data: JSON.parse(text) };
      } catch (e) {
        return {
          ok: false,
          status: 502,
          contentType: ct,
          bodySnippet: text.slice(0, 600),
        };
      }
    }

    function nominatimHeaders(language) {
      const h = new Headers();
      h.set("User-Agent", USER_AGENT);
      h.set("Referer", REFERER);
      h.set("Accept", "application/json");
      if (language) h.set("Accept-Language", language);
      return h;
    }

    // ---------- /geocode/search ----------
    if (path === "/geocode/search") {
      const q = url.searchParams.get("q");
      if (!q) return json({ error: "Missing q" }, 400);

      const limit = url.searchParams.get("limit") || "5";
      const countrycodes = url.searchParams.get("countrycodes") || "";
      const language = url.searchParams.get("language") || "";

      const upstream = new URL("https://nominatim.openstreetmap.org/search");
      upstream.searchParams.set("q", q);
      upstream.searchParams.set("format", "jsonv2"); // critical: force JSON
      upstream.searchParams.set("limit", limit);
      upstream.searchParams.set("addressdetails", "1");

      if (countrycodes) upstream.searchParams.set("countrycodes", countrycodes);
      if (CONTACT_EMAIL) upstream.searchParams.set("email", CONTACT_EMAIL);

      const res = await fetchJsonOrExplain(
        upstream.toString(),
        nominatimHeaders(language)
      );

      if (!res.ok) {
        return json(
          {
            error: "Nominatim returned non-JSON or error",
            upstream_status: res.status,
            upstream_content_type: res.contentType,
            upstream_body_snippet: res.bodySnippet,
          },
          502
        );
      }

      const results = (Array.isArray(res.data) ? res.data : []).map((x) => ({
        display_name: x.display_name,
        lat: Number(x.lat),
        lon: Number(x.lon),
        class: x.class,
        type: x.type,
        importance: x.importance,
        address: x.address || {},
      }));

      return json({ results });
    }

    // ---------- /geocode/reverse ----------
    if (path === "/geocode/reverse") {
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      if (!lat || !lon) return json({ error: "Missing lat/lon" }, 400);

      const language = url.searchParams.get("language") || "";

      const upstream = new URL("https://nominatim.openstreetmap.org/reverse");
      upstream.searchParams.set("lat", lat);
      upstream.searchParams.set("lon", lon);
      upstream.searchParams.set("format", "jsonv2"); // critical: force JSON
      upstream.searchParams.set("addressdetails", "1");

      if (CONTACT_EMAIL) upstream.searchParams.set("email", CONTACT_EMAIL);

      const res = await fetchJsonOrExplain(
        upstream.toString(),
        nominatimHeaders(language)
      );

      if (!res.ok) {
        return json(
          {
            error: "Nominatim returned non-JSON or error",
            upstream_status: res.status,
            upstream_content_type: res.contentType,
            upstream_body_snippet: res.bodySnippet,
          },
          502
        );
      }

      const x = res.data || {};
      return json({
        display_name: x.display_name,
        lat: Number(x.lat),
        lon: Number(x.lon),
        address: x.address || {},
      });
    }

    // ---------- /route ----------
    if (path === "/route") {
      const profile = url.searchParams.get("profile") || "driving";
      const coordinates = url.searchParams.get("coordinates");
      if (!coordinates) return json({ error: "Missing coordinates" }, 400);
      if (!["driving", "walking", "cycling"].includes(profile))
        return json({ error: "Invalid profile" }, 400);

      const upstream = new URL(
        `https://router.project-osrm.org/route/v1/${profile}/${coordinates}`
      );
      upstream.searchParams.set("overview", "false");
      upstream.searchParams.set("steps", "false");

      const r = await fetch(upstream.toString());
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.routes?.[0]) {
        return json(
          { error: "OSRM error", upstream_status: r.status, upstream: data },
          502
        );
      }

      return json({
        distance_m: data.routes[0].distance,
        duration_s: data.routes[0].duration,
      });
    }

    // ---------- /table ----------
    if (path === "/table") {
      const profile = url.searchParams.get("profile") || "driving";
      const coordinates = url.searchParams.get("coordinates");
      if (!coordinates) return json({ error: "Missing coordinates" }, 400);
      if (!["driving", "walking", "cycling"].includes(profile))
        return json({ error: "Invalid profile" }, 400);

      const annotations = url.searchParams.get("annotations") || "duration,distance";

      const upstream = new URL(
        `https://router.project-osrm.org/table/v1/${profile}/${coordinates}`
      );
      upstream.searchParams.set("annotations", annotations);

      const r = await fetch(upstream.toString());
      const data = await r.json().catch(() => null);
      if (!r.ok || !data) {
        return json(
          { error: "OSRM error", upstream_status: r.status, upstream: data },
          502
        );
      }

      return json({
        distances_m: data.distances || [],
        durations_s: data.durations || [],
      });
    }

    return json({ error: "Not found" }, 404);
  },
};
