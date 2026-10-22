/** Value for <input type="datetime-local"> in the browser's local time. */
export function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseCenter(value: string | undefined): [number, number] {
  const [lat, lng] = (value ?? "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : [37.8044, -122.2712];
}
