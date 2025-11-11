import { AppShell } from "@/app/components/AppShell";
import { ColorThemePicker } from "@/app/components/ColorThemePicker";
import { Button } from "@/app/components/Button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCallback } from "react";

export function ChildThemeSettings() {
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <AppShell title="Pick Your Colors!" variant="child">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleBack}
            size="child"
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft size={24} />
            Back
          </Button>
          <h1 className="text-4xl font-bold">Pick Your Favorite Colors!</h1>
        </div>

        <ColorThemePicker showLabel={false} variant="child" />
      </div>
    </AppShell>
  );
}
