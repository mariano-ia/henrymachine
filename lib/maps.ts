/** Deep-link a Google Maps con caminata desde la ubicación actual del usuario. */
export function mapsDirUrl(query: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    query
  )}&travelmode=walking`;
}
