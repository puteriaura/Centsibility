const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class OwnershipError extends Error {
  status: number;
  constructor(message: string, status = 404) {
    super(message);
    this.name = "OwnershipError";
    this.status = status;
  }
}

export async function verifyKidOwnership(
  client: any,
  kidId: string,
  parentId: string,
  select = "*",
): Promise<Record<string, any>> {
  if (!kidId || !UUID_REGEX.test(kidId)) {
    throw new OwnershipError("Invalid child", 400);
  }
  const { data: kid, error } = await client
    .from("kids")
    .select(select)
    .eq("id", kidId)
    .eq("parent_id", parentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!kid) throw new OwnershipError("Not found or not your child", 404);
  return kid as Record<string, any>;
}
