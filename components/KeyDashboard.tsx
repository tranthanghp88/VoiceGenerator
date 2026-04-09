import React from "react";

type Stat = {
  success: number;
  fail: number;
  lastUsed: number | null;
};

type Key = {
  label: string;
  disabled: boolean;
};

export default function KeyDashboard({
  stats,
  keys
}: {
  stats: Record<string, Stat>;
  keys: Key[];
}) {
  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      {keys.map(k => {
        const s = stats[k.label];

        let color = "bg-gray-200";

        if (k.disabled) color = "bg-red-400";
        else if (s?.fail > 0) color = "bg-yellow-300";
        else if (s?.success > 0) color = "bg-green-400";

        return (
          <div key={k.label} className={`p-3 rounded text-black`}>
            <div className={`p-3 rounded ${color}`}>
              <div className="font-bold">{k.label}</div>
              <div>OK: {s?.success || 0}</div>
              <div>Fail: {s?.fail || 0}</div>
              <div>
                {k.disabled ? "⛔ Disabled" : "✅ Active"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}