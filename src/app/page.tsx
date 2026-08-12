import { PhotobookApp } from "@/components/photobook-app";
import { TooltipProvider } from "@/components/ui/icon-button";

export default function Home() {
  return <TooltipProvider><PhotobookApp /></TooltipProvider>;
}
