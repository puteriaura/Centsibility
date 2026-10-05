const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class StatementError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "StatementError";
    this.status = status;
  }
}

export function mytRange(from: string, to: string): { startIso: string; endIso: string } {
  if (!from || !to || !DATE_REGEX.test(from) || !DATE_REGEX.test(to)) {
    throw new StatementError("Invalid date format. Expected yyyy-MM-dd", 400);
  }
  const startDate = new Date(`${from}T00:00:00+08:00`);
  const endDate = new Date(`${to}T23:59:59.999+08:00`);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new StatementError("Invalid date values", 400);
  }

  return {
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
  };
}
