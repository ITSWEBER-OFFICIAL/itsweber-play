import { Wizard } from "./_wizard";

// Server-Wrapper für Metadata + saubere Page-Boundary. Alle State-Logik
// (Multi-Step, tRPC-Calls, Logo-Upload) lebt in der Client-Component.
export const metadata = {
  title: "Setup · ITSWEBER Play",
};

export default function SetupPage() {
  return <Wizard />;
}
