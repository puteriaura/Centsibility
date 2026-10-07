export function marketPricePresentation(
  state: "open" | "closed" | "unknown",
  quote?: number | null,
  lastClose?: number | null,
) {
  const valid = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0;
  if (state === "closed") {
    if (valid(lastClose))
      return { price: lastClose, label: "Market closed, showing last close" };
    return {
      price: valid(quote) ? quote : null,
      label: valid(quote)
        ? "Market closed · last close unavailable; showing last saved quote"
        : "Market closed · data unavailable",
    };
  }
  return {
    price: valid(quote) ? quote : null,
    label:
      state === "unknown"
        ? "Market status unavailable"
        : valid(quote)
          ? "Delayed price"
          : "Data unavailable",
  };
}
