import { PhotobookApp } from "@/components/photobook-app";
import { AuthProvider } from "@/components/auth/auth-provider";
import { TooltipProvider } from "@/components/ui/icon-button";

export default function Home() {
  return <AuthProvider><TooltipProvider><PhotobookApp /></TooltipProvider></AuthProvider>;
}
