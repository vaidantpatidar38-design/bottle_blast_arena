const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tier = url.searchParams.get("tier") ?? "low";

    const apiKey = Deno.env.get("GIPHY_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ url: null, error: "GIPHY_API_KEY not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const query = tier === "high" ? "celebration winner" : "epic fail funny";
    const giphyUrl = `https://api.giphy.com/v1/gifs/random?api_key=${apiKey}&tag=${encodeURIComponent(query)}&rating=g`;

    const giphyRes = await fetch(giphyUrl);
    if (!giphyRes.ok) {
      throw new Error(`Giphy API error: ${giphyRes.status}`);
    }
    const json = await giphyRes.json();
    const gifUrl: string | null = json?.data?.images?.downsized?.url ?? null;

    return new Response(
      JSON.stringify({ url: gifUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ url: null, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
