type Admin = { from(table: string): { select(columns: string, options: { count: "exact"; head: true }): { eq(column: string, value: string): PromiseLike<{ count: number | null; error: unknown }> } } };

export async function enforceKidLimit(admin: Admin, parentId: string, corsHeaders: Record<string, string>) {
  const { count, error } = await admin.from("kids").select("id", { count: "exact", head: true }).eq("parent_id", parentId);
  if (!error && count !== null && count < 10) return null;
  return new Response(JSON.stringify(error || count === null
    ? { error: "Child limit check unavailable. Please try again." }
    : { error: "You can have up to 10 children.", code: "kid_limit" }), {
    status: error || count === null ? 503 : 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
