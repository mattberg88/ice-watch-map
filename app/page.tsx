import MapApp from "@/components/MapApp";
import { parseCenter } from "@/lib/format";

export default function Home() {
  return (
    <MapApp
      appName={process.env.NEXT_PUBLIC_APP_NAME || "ICE Watch Bay Area"}
      center={parseCenter(process.env.NEXT_PUBLIC_MAP_CENTER)}
      zoom={Number(process.env.NEXT_PUBLIC_MAP_ZOOM) || 12}
      hotlineLabel={process.env.NEXT_PUBLIC_HOTLINE_LABEL || "Rapid response hotline"}
      hotlineNumber={process.env.NEXT_PUBLIC_HOTLINE_NUMBER || ""}
    />
  );
}
