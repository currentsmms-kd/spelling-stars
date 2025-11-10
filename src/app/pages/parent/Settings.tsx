import { useState, useEffect } from "react";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { ColorThemePicker } from "@/app/components/ColorThemePicker";
import { useParentalSettingsStore } from "@/app/store/parentalSettings";
import { useThemeStore } from "@/app/store/theme";
import { useAuth } from "@/app/hooks/useAuth";
import { supabase } from "@/app/supabase";
import { Lock, Save, Settings, Trash2, RefreshCw } from "lucide-react";
import { isValidPinFormat } from "@/lib/crypto";
import { clearUserCaches, clearAllCaches, getCacheInfo } from "@/lib/cache";

// Extracted PIN Settings Component
function PinSettings({
  localPin,
  setLocalPin,
  confirmPin,
  setConfirmPin,
}: {
  localPin: string;
  setLocalPin: (pin: string) => void;
  confirmPin: string;
  setConfirmPin: (pin: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <Lock className="text-primary" size={24} />
        <h2 className="text-xl font-bold">PIN Lock</h2>
      </div>
      <p className="text-muted-foreground mb-4">
        Set a 4-digit PIN to lock the parent area. Leave blank to keep current
        PIN.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="new-pin"
            className="block text-sm font-medium text-foreground mb-2"
          >
            New PIN (4 digits)
          </label>
          <input
            id="new-pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={localPin}
            onChange={(e) => setLocalPin(e.target.value.replace(/\D/g, ""))}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
            placeholder="Enter 4 digits"
          />
        </div>
        <div>
          <label
            htmlFor="confirm-pin"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Confirm PIN
          </label>
          <input
            id="confirm-pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
            placeholder="Confirm PIN"
          />
        </div>
      </div>
    </Card>
  );
}

// Extracted Checkbox Setting Component
function CheckboxSetting({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-5 h-5 text-primary rounded focus:ring-2 focus:ring-ring cursor-pointer"
      />
      <label htmlFor={id} className="cursor-pointer">
        <div className="font-medium">{label}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </label>
    </div>
  );
}

// Extracted Game Settings Component
function GameSettings({
  settings,
  onSettingsChange,
}: {
  settings: {
    showHintsOnFirstMiss: boolean;
    enforceCaseSensitivity: boolean;
    autoReadbackSpelling: boolean;
  };
  onSettingsChange: (
    settings: Partial<{
      showHintsOnFirstMiss: boolean;
      enforceCaseSensitivity: boolean;
      autoReadbackSpelling: boolean;
      dailySessionLimitMinutes: number;
      defaultTtsVoice: string;
    }>
  ) => void;
}) {
  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Game Settings</h2>
      <div className="space-y-4">
        <CheckboxSetting
          id="show-hints"
          label="Show hints on first miss"
          description="Display hints after the child misses a word once"
          checked={settings.showHintsOnFirstMiss}
          onChange={(checked) =>
            onSettingsChange({ showHintsOnFirstMiss: checked })
          }
        />
        <CheckboxSetting
          id="case-sensitivity"
          label="Enforce case sensitivity"
          description="Require correct capitalization for answers"
          checked={settings.enforceCaseSensitivity}
          onChange={(checked) =>
            onSettingsChange({ enforceCaseSensitivity: checked })
          }
        />
        <CheckboxSetting
          id="auto-readback"
          label="Auto read-back correct spelling"
          description="Automatically read the correct spelling after each answer"
          checked={settings.autoReadbackSpelling}
          onChange={(checked) =>
            onSettingsChange({ autoReadbackSpelling: checked })
          }
        />
      </div>
    </Card>
  );
}

// Extracted Session Limits Component
function SessionLimits({
  dailySessionLimitMinutes,
  onLimitChange,
}: {
  dailySessionLimitMinutes: number;
  onLimitChange: (minutes: number) => void;
}) {
  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Session Limits</h2>
      <div>
        <label
          htmlFor="session-limit"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Daily session limit (minutes)
        </label>
        <input
          id="session-limit"
          type="number"
          min="5"
          max="60"
          value={dailySessionLimitMinutes}
          onChange={(e) => onLimitChange(parseInt(e.target.value) || 20)}
          className="w-full md:w-48 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
        />
        <p className="text-sm text-muted-foreground mt-2">
          Child will be gently prompted to take a break after this time
        </p>
      </div>
    </Card>
  );
}

// Extracted TTS Settings Component
function TtsSettings({
  defaultTtsVoice,
  onVoiceChange,
}: {
  defaultTtsVoice: string;
  onVoiceChange: (voice: string) => void;
}) {
  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Text-to-Speech</h2>
      <div>
        <label
          htmlFor="default-voice"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Default voice
        </label>
        <select
          id="default-voice"
          value={defaultTtsVoice}
          onChange={(e) => onVoiceChange(e.target.value)}
          className="w-full md:w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-input"
        >
          <option value="en-US">English (US)</option>
          <option value="en-GB">English (UK)</option>
          <option value="en-AU">English (Australia)</option>
          <option value="en-IN">English (India)</option>
        </select>
        <p className="text-sm text-muted-foreground mt-2">
          You can override this for individual words in the List Editor
        </p>
      </div>
    </Card>
  );
}

// Cache Management Component
function CacheManagement() {
  const [cacheInfo, setCacheInfo] = useState<Map<string, number>>(new Map());
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadCacheInfo = async () => {
    const info = await getCacheInfo();
    setCacheInfo(info);
  };

  useEffect(() => {
    loadCacheInfo();
  }, []);

  const handleClearUserCaches = async () => {
    setIsClearing(true);
    setMessage(null);
    try {
      await clearUserCaches();
      setMessage("User caches cleared successfully");
      await loadCacheInfo();
    } catch (error) {
      setMessage("Failed to clear user caches");
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearAllCaches = async () => {
    if (
      !confirm(
        "This will clear ALL caches, including downloaded content. Continue?"
      )
    ) {
      return;
    }
    setIsClearing(true);
    setMessage(null);
    try {
      await clearAllCaches();
      setMessage("All caches cleared successfully");
      await loadCacheInfo();
    } catch (error) {
      setMessage("Failed to clear all caches");
    } finally {
      setIsClearing(false);
    }
  };

  const totalCachedItems = Array.from(cacheInfo.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Cache Management</h2>
      <p className="text-muted-foreground mb-4">
        Clear cached data to free up space or fix issues. User caches are
        automatically cleared when you sign out.
      </p>

      {message && (
        <div className="p-3 mb-4 rounded-lg bg-secondary/10 border border-secondary text-secondary-foreground">
          {message}
        </div>
      )}

      <div className="space-y-4">
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="text-sm text-muted-foreground mb-2">Cache Status</div>
          <div className="font-medium">
            {totalCachedItems} item{totalCachedItems !== 1 ? "s" : ""} cached
          </div>
          {cacheInfo.size > 0 && (
            <div className="mt-2 text-sm text-muted-foreground space-y-1">
              {Array.from(cacheInfo.entries()).map(([name, count]) => (
                <div key={name}>
                  {name}: {count} item{count !== 1 ? "s" : ""}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            onClick={handleClearUserCaches}
            disabled={isClearing}
            variant="outline"
            className="flex items-center justify-center gap-2"
          >
            <Trash2 size={18} aria-hidden="true" />
            Clear User Data
          </Button>
          <Button
            onClick={handleClearAllCaches}
            disabled={isClearing}
            variant="outline"
            className="flex items-center justify-center gap-2"
          >
            <RefreshCw size={18} aria-hidden="true" />
            Clear All Caches
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          <strong>Clear User Data:</strong> Removes personal content caches
          (routes and API data). Safe for regular use.
          <br />
          <strong>Clear All Caches:</strong> Removes everything including
          downloaded assets. Use if experiencing issues.
        </p>
      </div>
    </Card>
  );
}

export function ParentalSettings() {
  const { profile } = useAuth();
  const {
    pinCode,
    showHintsOnFirstMiss,
    enforceCaseSensitivity,
    autoReadbackSpelling,
    dailySessionLimitMinutes,
    defaultTtsVoice,
    setSettings,
    setPinCode,
  } = useParentalSettingsStore();
  const { currentTheme, setTheme } = useThemeStore();

  const [localPin, setLocalPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [localSettings, setLocalSettings] = useState({
    showHintsOnFirstMiss,
    enforceCaseSensitivity,
    autoReadbackSpelling,
    dailySessionLimitMinutes,
    defaultTtsVoice,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) return;

      try {
        const { data, error } = await supabase
          .from("parental_settings")
          .select("*")
          .eq("parent_id", profile.id)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error loading settings:", error);
          return;
        }

        if (data) {
          const newSettings = {
            showHintsOnFirstMiss: data.show_hints_on_first_miss,
            enforceCaseSensitivity: data.enforce_case_sensitivity,
            autoReadbackSpelling: data.auto_readback_spelling,
            dailySessionLimitMinutes: data.daily_session_limit_minutes,
            defaultTtsVoice: data.default_tts_voice,
          };
          setLocalSettings(newSettings);
          setSettings(newSettings);
          setPinCode(data.pin_code);

          // Load and apply theme
          if (data.color_theme) {
            setTheme(data.color_theme);
          }
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      }
    };

    load();
  }, [profile, setSettings, setPinCode, setTheme]);

  const handleSave = async () => {
    if (!profile?.id) return;

    // Validate PIN if changed
    if (localPin) {
      if (!isValidPinFormat(localPin)) {
        setMessage({ type: "error", text: "PIN must be exactly 4 digits" });
        return;
      }
      if (localPin !== confirmPin) {
        setMessage({ type: "error", text: "PINs do not match" });
        return;
      }
    }

    setIsSaving(true);
    setMessage(null);

    try {
      // Hash the PIN if changed, otherwise keep existing
      let hashedPin = pinCode;
      if (localPin) {
        await setPinCode(localPin); // This hashes and stores the PIN
        hashedPin = useParentalSettingsStore.getState().pinCode;
      }

      if (!hashedPin) {
        setMessage({ type: "error", text: "PIN is required" });
        setIsSaving(false);
        return;
      }

      const { error } = await supabase.from("parental_settings").upsert({
        parent_id: profile.id,
        pin_code: hashedPin,
        show_hints_on_first_miss: localSettings.showHintsOnFirstMiss,
        enforce_case_sensitivity: localSettings.enforceCaseSensitivity,
        auto_readback_spelling: localSettings.autoReadbackSpelling,
        daily_session_limit_minutes: localSettings.dailySessionLimitMinutes,
        default_tts_voice: localSettings.defaultTtsVoice,
        color_theme: currentTheme,
      });

      if (error) throw error;

      // Update local store
      setSettings(localSettings);

      setMessage({ type: "success", text: "Settings saved successfully!" });
      setLocalPin("");
      setConfirmPin("");
    } catch (err) {
      console.error("Error saving settings:", err);
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell title="Parental Settings" variant="parent">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="text-primary" size={32} />
          <h1 className="text-3xl font-bold">Parental Settings</h1>
        </div>

        {message && (
          <div
            className={`p-4 rounded-lg border ${
              message.type === "success"
                ? "bg-secondary/10 border-secondary text-secondary-foreground"
                : "bg-destructive/10 border-destructive text-destructive-foreground"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* PIN Settings */}
        <PinSettings
          localPin={localPin}
          setLocalPin={setLocalPin}
          confirmPin={confirmPin}
          setConfirmPin={setConfirmPin}
        />

        {/* Game Settings */}
        <GameSettings
          settings={{
            showHintsOnFirstMiss: localSettings.showHintsOnFirstMiss,
            enforceCaseSensitivity: localSettings.enforceCaseSensitivity,
            autoReadbackSpelling: localSettings.autoReadbackSpelling,
          }}
          onSettingsChange={(newSettings) =>
            setLocalSettings({ ...localSettings, ...newSettings })
          }
        />

        {/* Session Limits */}
        <SessionLimits
          dailySessionLimitMinutes={localSettings.dailySessionLimitMinutes}
          onLimitChange={(minutes) =>
            setLocalSettings({
              ...localSettings,
              dailySessionLimitMinutes: minutes,
            })
          }
        />

        {/* TTS Settings */}
        <TtsSettings
          defaultTtsVoice={localSettings.defaultTtsVoice}
          onVoiceChange={(voice) =>
            setLocalSettings({ ...localSettings, defaultTtsVoice: voice })
          }
        />

        {/* Cache Management */}
        <CacheManagement />

        {/* Color Theme Picker */}
        <Card>
          <ColorThemePicker showLabel={true} variant="parent" />
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="lg"
            className="flex items-center gap-2"
          >
            <Save size={20} aria-hidden="true" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
