import DemoApp from "@/components/DemoApp";
import { getDemoVideoTitles, getDemoVideos } from "@/lib/demo-session";

export default function Home() {
  return (
    <DemoApp
      videoTitles={getDemoVideoTitles()}
      videoCount={getDemoVideos().length}
    />
  );
}
