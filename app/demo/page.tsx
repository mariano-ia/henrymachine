import DemoApp from "@/components/DemoApp";
import { getDemoVideoTitles, getDemoVideos } from "@/lib/demo-session";

export default function DemoPage() {
  return (
    <DemoApp
      videoTitles={getDemoVideoTitles()}
      videoCount={getDemoVideos().length}
    />
  );
}
