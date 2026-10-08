export function MarketPickerStatus({ state, updatedAt }: { state: "open" | "closed" | "unknown"; updatedAt?: string | null }) {
  return <span>{state === "closed" ? "Market closed, showing last close where available" : state === "unknown" ? "Market status unavailable" : "Delayed price"}{updatedAt ? <> · updated {updatedAt}</> : null}</span>;
}
