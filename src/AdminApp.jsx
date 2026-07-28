import { useState, useEffect } from "react";

import { MENU } from "./menu";
import { GAS_WEB_APP_URL } from "./config";

// 依照 menu.js 的順序，把兩選項品項（如刈包）展開成獨立列，後台一列對應一個可上下架、可改價的單位
function buildFlatItems() {
  const flat = [];

  MENU.forEach(item => {
    if (item.type === "two-options") {
      item.options.forEach(opt => {
        flat.push({ id: opt.id, uiName: opt.uiName, defaultPrice: opt.price });
      });
    } else {
      flat.push({ id: item.id, uiName: item.uiName, defaultPrice: item.price });
    }
  });

  return flat;
}

export default function AdminApp() {
  const [rows, setRows] = useState(() =>
    buildFlatItems().map(it => ({ ...it, price: it.defaultPrice, enabled: true }))
  );
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: "success" | "error", text }

  useEffect(() => {
    async function loadMenu() {
      try {
        const res = await fetch(`${GAS_WEB_APP_URL}?action=getMenu&t=${Date.now()}`, {
          cache: "no-store"
        });
        const data = await res.json();

        if (data && data.success && Array.isArray(data.items)) {
          setRows(prev =>
            prev.map(row => {
              const remote = data.items.find(it => it.id === row.id);
              if (!remote) return row;
              return {
                ...row,
                price: Number(remote.price),
                enabled: remote.enabled !== false
              };
            })
          );
        } else {
          setMessage({ type: "error", text: "後台尚未設定完成，目前顯示的是本地預設值" });
        }
      } catch (err) {
        setMessage({ type: "error", text: "讀取菜單設定失敗：" + (err.message || String(err)) });
      } finally {
        setLoading(false);
      }
    }

    loadMenu();
  }, []);

  const updateRow = (id, patch) => {
    setRows(prev => prev.map(row => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleSave = async () => {
    if (!passcode) {
      setMessage({ type: "error", text: "請先輸入管理密碼" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(GAS_WEB_APP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "updateMenu",
          passcode,
          items: rows.map(r => ({
            id: r.id,
            price: Number(r.price),
            enabled: r.enabled
          }))
        })
      });

      const data = await res.json();

      if (!data || data.success !== true) {
        throw new Error((data && data.message) || "更新失敗");
      }

      setMessage({ type: "success", text: "菜單設定已更新" });
    } catch (err) {
      setMessage({ type: "error", text: "儲存失敗：" + (err.message || String(err)) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 p-4">
      <h1 className="text-xl font-bold text-gray-800 mb-4">菜單後台管理</h1>

      {message && (
        <div
          className={`mb-4 p-3 rounded-xl text-sm font-bold ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">讀取目前設定中...</div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.id} className="bg-white rounded-xl border shadow-sm p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-800 text-sm truncate">{row.uiName}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    value={row.price}
                    onChange={e => updateRow(row.id, { price: e.target.value })}
                    className="w-20 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => updateRow(row.id, { enabled: !row.enabled })}
                className={`px-4 py-2 rounded-lg text-sm font-bold shrink-0 ${
                  row.enabled
                    ? "bg-orange-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {row.enabled ? "上架中" : "已下架"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-3">
        <input
          type="password"
          placeholder="管理密碼"
          value={passcode}
          onChange={e => setPasscode(e.target.value)}
          className="w-full border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className={`w-full py-3.5 rounded-xl font-bold text-white shadow-md ${
            saving || loading ? "bg-gray-400" : "bg-orange-600 active:bg-orange-700"
          }`}
        >
          {saving ? "儲存中..." : "儲存變更"}
        </button>
      </div>
    </div>
  );
}
