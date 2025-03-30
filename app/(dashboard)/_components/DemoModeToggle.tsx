// app/(dashboard)/components/DemoModeToggle.tsx
"use client";

import { Button } from "@/components/ui/button";
import { useDemoMode } from "@/app/context/DemoContext";

export function DemoModeToggle() {
  const { isDemoMode, enableDemoMode, disableDemoMode } = useDemoMode();

  return (
    <div className="flex gap-2">
      {!isDemoMode ? (
        <Button 
          variant="outline" 
          size="sm"
          onClick={enableDemoMode}
        >
          Generate Demo Data
        </Button>
      ) : (
        <Button 
          variant="outline" 
          size="sm"
          onClick={disableDemoMode}
        >
          Restore Real Data
        </Button>
      )}
    </div>
  );
}