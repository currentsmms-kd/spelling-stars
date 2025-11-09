import { Check, AlertCircle, X } from "lucide-react";

interface ToastProps {
  type: "success" | "error" | "info";
  message: string;
  onClose?: () => void;
}

export function Toast({ type, message, onClose }: ToastProps) {
  const styles = {
    success: "bg-green-500 text-white",
    error: "bg-red-500 text-white",
    info: "bg-blue-500 text-white",
  };

  const icons = {
    success: <Check size={20} />,
    error: <AlertCircle size={20} />,
    info: <AlertCircle size={20} />,
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${styles[type]} animate-in slide-in-from-top-2 duration-300`}
    >
      <div className="flex items-center gap-2">
        {icons[type]}
        <span className="font-medium">{message}</span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 hover:opacity-80 transition-opacity"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
