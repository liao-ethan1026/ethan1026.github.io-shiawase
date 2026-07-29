import { useState, useEffect } from "react";

import { MENU } from "./menu";
import { GAS_WEB_APP_URL } from "./config";

// 把 menu.js 轉成後台可編輯的卡片結構。
// 兩選項品項（刈包）用第一個選項的 id 當「代表列」，卡片的品名/描述/排序都存在這個 id 底下，
// 第二個選項只負責自己的價格與上架狀態，跟前端 App.jsx 的 getPrimaryId 邏輯一致。
function buildCards() {
  return MENU.map((item, idx) => {
    if (item.type === "two-options") {
      return {
        key: item.options[0].id,
        type: "two-options",
        primaryId: item.options[0].id,
        name: item.title,
        description: "", // 目前刈包卡片沒有描述文字欄位可顯示
        hasDescription: false,
        order: idx + 1,
        options: item.options.map(opt => ({
          id: opt.id,
          label: opt.shortName,
          price: opt.price,
          enabled: true
        }))
      };
    }

    return {
      key: item.id,
      type: "single",
      primaryId: item.id,
      name: item.title,
      description: item.description || "",
      hasDescription: true,
      order: idx + 1,
      options: [
        { id: item.id, label: null, price: item.price, enabled: true }
      ]
    };
  });
}

export default function AdminApp() {
  const [cards, setCards] = useState(buildCards);
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
          setCards(prev =>
            prev.map(card => {
              const primaryRemote = data.items.find(it => it.id === card.primaryId);

              return {
                ...card,
                name: (primaryRemote && primaryRemote.name) || card.name,
                description:
                  primaryRemote && primaryRemote.description !== undefined
                    ? primaryRemote.description
                    : card.description,
                order:
                  primaryRemote && typeof primaryRemote.order === "number" && !Number.isNaN(primaryRemote.order)
                    ? primaryRemote.order
                    : card.order,
                options: card.options.map(opt => {
                  const remote = data.items.find(it => it.id === opt.id);
                  if (!remote) return opt;
                  return {
                    ...opt,
                    price: Number(remote.price),
                    enabled: remote.enabled !== false
                  };
                })
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

  const updateCard = (key, patch) => {
    setCards(prev => prev.map(card => (card.key === key ? { ...card, ...patch } : card)));
  };

  const updateOption = (cardKey, optionId, patch) => {
    setCards(prev =>
      prev.map(card => {
        if (card.key !== cardKey) return card;
        return {
          ...card,
          options: card.options.map(opt => (opt.id === optionId ? { ...opt, ...patch } : opt))
        };
      })
    );
  };

  const handleSave = async () => {
    if (!passcode) {
      setMessage({ type: "error", text: "請先輸入管理密碼" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const items = [];

      cards.forEach(card => {
        card.options.forEach((opt, optIdx) => {
          const payload = {
            id: opt.id,
            price: Number(opt.price),
            enabled: opt.enabled
          };

          // 只有卡片的代表列（第一個選項）才帶品名/描述/排序，
          // 避免刈包的第二個選項把整張卡片的標題誤蓋成空白
          if (optIdx === 0) {
            payload.name = card.name;
            payload.description = card.description;
            payload.order = Number(card.order) || 0;
          }

          items.push(payload);
        });
      });

      const res = await fetch(GAS_WEB_APP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "updateMenu",
          passcode,
          items
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
          {cards.map(card => (
            <div key={card.key} className="bg-white rounded-xl border shadow-sm p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="品名"
                  value={card.name}
                  onChange={e => updateCard(card.key, { name: e.target.value })}
                  className="flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-gray-400">排序</span>
                  <input
                    type="number"
                    value={card.order}
                    onChange={e => updateCard(card.key, { order: e.target.value })}
                    className="w-14 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {card.hasDescription && (
                <input
                  type="text"
                  placeholder="描述文字（例如：大份量聚餐首選）"
                  value={card.description}
                  onChange={e => updateCard(card.key, { description: e.target.value })}
                  className="w-full border rounded-lg px-2 py-1.5 text-xs text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              )}

              <div className="space-y-2 pt-1">
                {card.options.map(opt => (
                  <div key={opt.id} className="flex items-center gap-2 pl-2 border-l-2 border-orange-100">
                    {opt.label && (
                      <span className="text-xs text-gray-500 w-14 shrink-0 truncate">{opt.label}</span>
                    )}

                    <span className="text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      value={opt.price}
                      onChange={e => updateOption(card.key, opt.id, { price: e.target.value })}
                      className="w-20 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />

                    <button
                      type="button"
                      onClick={() => updateOption(card.key, opt.id, { enabled: !opt.enabled })}
                      className={`ml-auto px-4 py-1.5 rounded-lg text-sm font-bold shrink-0 ${
                        opt.enabled ? "bg-orange-600 text-white" : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {opt.enabled ? "上架中" : "已下架"}
                    </button>
                  </div>
                ))}
              </div>
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
