import { notFound } from "next/navigation";

// Prototipo retirado antes del lanzamiento. La página queda en 404 (el stack
// legacy DemoApp/ChatScreen/demo-session sigue en el repo hasta borrarlo).
export default function DemoPage() {
  notFound();
}
