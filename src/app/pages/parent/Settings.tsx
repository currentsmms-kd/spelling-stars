import { useState, useEffect } from "react";
import { AppShell } from "@/app/components/AppShell";
import { Card } from "@/app/components/Card";
import { Button } from "@/app/components/Button";
import { useParentalSettingsStore } from "@/app/store/parentalSettings";
import { useAuth } from "@/app/hooks/useAuth";
import { supabase } from "@/app/supabase";
import { Lock, Save, Settings } from "lucide-react";

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
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      }
    };

    load();
  }, [profile, setSettings, setPinCode]);

  const handleSave = async () => {
    if (!profile?.id) return;

    // Validate PIN if changed
    if (localPin) {
      if (localPin.length !== 4 || !/^\d{4}$/.test(localPin)) {
        setMessage({ type: "error", text: "PIN must be 4 digits" });
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
      const hashedPin = localPin ? btoa(localPin) : pinCode;

      if (!hashedPin) {
        setMessage({ type: "error", text: "PIN is required" });
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
      });

      if (error) throw error;

      // Update local store
      setSettings(localSettings);
      if (hashedPin) {
        setPinCode(hashedPin);
      }

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
          <Settings className="text-primary-600" size={32} />
          <h1 className="text-3xl font-bold">Parental Settings</h1>
        </div>

        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* PIN Settings */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Lock className="text-primary-600" size={24} />
            <h2 className="text-xl font-bold">PIN Lock</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Set a 4-digit PIN to lock the parent area. Leave blank to keep
            current PIN.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New PIN (4 digits)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={localPin}
                onChange={(e) => setLocalPin(e.target.value.replace(/\D/g, ""))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter 4 digits"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) =>
                  setConfirmPin(e.target.value.replace(/\D/g, ""))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Confirm PIN"
              />
            </div>
          </div>
        </Card>

        {/* Game Settings */}
        <Card>
          <h2 className="text-xl font-bold mb-4">Game Settings</h2>
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.showHintsOnFirstMiss}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    showHintsOnFirstMiss: e.target.checked,
                  })
                }
                className="mt-1 w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
              />
              <div>
                <div className="font-medium">Show hints on first miss</div>
                <div className="text-sm text-gray-600">
                  Display hints after the child misses a word once
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.enforceCaseSensitivity}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    enforceCaseSensitivity: e.target.checked,
                  })
                }
                className="mt-1 w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
              />
              <div>
                <div className="font-medium">Enforce case sensitivity</div>
                <div className="text-sm text-gray-600">
                  Require correct capitalization for answers
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.autoReadbackSpelling}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    autoReadbackSpelling: e.target.checked,
                  })
                }
                className="mt-1 w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
              />
              <div>
                <div className="font-medium">
                  Auto read-back correct spelling
                </div>
                <div className="text-sm text-gray-600">
                  Automatically read the correct spelling after each answer
                </div>
              </div>
            </label>
          </div>
        </Card>

        {/* Session Limits */}
        <Card>
          <h2 className="text-xl font-bold mb-4">Session Limits</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Daily session limit (minutes)
            </label>
            <input
              type="number"
              min="5"
              max="60"
              value={localSettings.dailySessionLimitMinutes}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  dailySessionLimitMinutes: parseInt(e.target.value) || 20,
                })
              }
              className="w-full md:w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-600 mt-2">
              Child will be gently prompted to take a break after this time
            </p>
          </div>
        </Card>

        {/* TTS Settings */}
        <Card>
          <h2 className="text-xl font-bold mb-4">Text-to-Speech</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default voice
            </label>
            <select
              value={localSettings.defaultTtsVoice}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  defaultTtsVoice: e.target.value,
                })
              }
              className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="en-AU">English (Australia)</option>
              <option value="en-IN">English (India)</option>
            </select>
            <p className="text-sm text-gray-600 mt-2">
              You can override this for individual words in the List Editor
            </p>
          </div>
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
