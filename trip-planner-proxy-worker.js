export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const userAgent = env.USER_AGENT || "TripPlannerGPT/1.0";
    const contactEmail = env.CONTACT_EMAIL || "";

    function json(data, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      if (path === "/geocode/search") {
        const q = url.searchParams.get("q");
        if (!q) return json({ error: "Missing q" }, 400);

        const limit = url.searchParams.get("limit") || "5";
        const countrycodes = url.searchParams.get("countrycodes") || "";
        const language = url.searchParams.get("language") || "";

        const upstream = new URL("https://nominatim.openstreetmap.org/search");
        upstream.searchParams.set("q", q);
        upstream.searchParams.set("format", "jsonv2");
        upstream.searchParams.set("limit", limit);
        upstream.searchParams.set("addressdetails", "1");

        if (countrycodes) upstream.searchParams.set("countrycodes", countrycodes);
        if (contactEmail) upstream.searchParams.set("email", contactEmail);

        const headers = new Headers();
        headers.set("User-Agent", userAgent);
        if (language) headers.set("Accept-Language", language);

        const r = await fetch(upstream.toString(), { headers });
        const data = await r.json();

        const results = (Array.isArray(data) ? data : []).map((x) => ({
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

      if (path === "/geocode/reverse") {
        const lat = url.searchParams.get("lat");
        const lon = url.searchParams.get("lon");
        if (!lat || !lon) return json({ error: "Missing lat/lon" }, 400);

        const language = url.searchParams.get("language") || "";

        const upstream = new URL("https://nominatim.openstreetmap.org/reverse");
        upstream.searchParams.set("lat", lat);
        upstream.searchParams.set("lon", lon);
        upstream.searchParams.set("format", "jsonv2");
        upstream.searchParams.set("addressdetails", "1");
        if (contactEmail) upstream.searchParams.set("email", contactEmail);

        const headers = new Headers();
        headers.set("User-Agent", userAgent);
        if (language) headers.set("Accept-Language", language);

        const r = await fetch(upstream.toString(), { headers });
        const x = await r.json();

        return json({
          display_name: x.display_name,
          lat: Number(x.lat),
          lon: Number(x.lon),
          address: x.address || {},
        });
      }

      if (path === "/route") {
        const profile = url.searchParams.get("profile") || "driving";
        const coordinates = url.searchParams.get("coordinates");
        if (!coordinates) return json({ error: "Missing coordinates" }, 400);

        const upstream = new URL(`https://router.project-osrm.org/route/v1/${profile}/${coordinates}`);
        upstream.searchParams.set("overview", "false");
        upstream.searchParams.set("steps", "false");

        const r = await fetch(upstream.toString());
        const data = await r.json();
        if (!data.routes || !data.routes[0]) return json({ error: "No route" }, 502);

        return json({
          distance_m: data.routes[0].distance,
          duration_s: data.routes[0].duration,
        });
      }

      if (path === "/table") {
        const profile = url.searchParams.get("profile") || "driving";
        const coordinates = url.searchParams.get("coordinates");
        if (!coordinates) return json({ error: "Missing coordinates" }, 400);

        const annotations = url.searchParams.get("annotations") || "duration,distance";

        const upstream = new URL(`https://router.project-osrm.org/table/v1/${profile}/${coordinates}`);
        upstream.searchParams.set("annotations", annotations);

        const r = await fetch(upstream.toString());
        const data = await r.json();

        return json({
          distances_m: data.distances || [],
          durations_s: data.durations || [],
        });
      }

      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: "Upstream failure", detail: String(e) }, 502);
    }
  },
};
