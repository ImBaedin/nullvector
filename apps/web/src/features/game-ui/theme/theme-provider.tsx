import { cn } from "@/lib/utils";

type GameThemeProviderProps = {
  children: React.ReactNode;
  className?: string;
};

export function GameThemeProvider({ children, className }: GameThemeProviderProps) {
  return <div className={cn("game-theme-neon-dockyard", className)}>{children}</div>;
}
