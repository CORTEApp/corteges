export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const headers = {
  "Cache-Control": "no-store",
}

export async function GET() {
  return Response.json(
    {
      ok: true,
      status: "healthy",
      service: "corteges",
    },
    { headers },
  )
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers,
  })
}
