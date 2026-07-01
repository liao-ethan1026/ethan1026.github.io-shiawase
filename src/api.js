// 對外溝通的函式集中在這裡：組裝 LINE Flex Message、回傳聊天室、寫入 Google 試算表
import liff from "@line/liff";
import { MENU } from "./menu";
import { GAS_WEB_APP_URL } from "./config";

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (e) {
    return String(value);
  }
}

export function buildCustomerFlexMessage(order) {
  const rows = [];

  const addRow = (name, qty, price) => {
    if (qty <= 0) return;

    rows.push({
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: `${name} x ${qty}`,
          size: "sm",
          color: "#333333",
          flex: 5,
          wrap: true
        },
        {
          type: "text",
          text: `$${qty * price}`,
          size: "sm",
          color: "#333333",
          align: "end",
          flex: 2
        }
      ]
    });
  };

  MENU.forEach(item => {
    if (item.type === "two-options") {
      item.options.forEach(opt => {
        if (order.items[opt.id] > 0) {
          addRow(opt.flexName, order.items[opt.id], opt.price);
        }
      });
    } else {
      if (order.items[item.id] > 0) {
        addRow(item.flexName, order.items[item.id], item.price);
      }
    }
  });

  return {
    type: "flex",
    altText: "大嫂素食刈包訂單明細",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "大嫂素食刈包 訂單明細",
            weight: "bold",
            size: "xl",
            color: "#EA580C"
          },
          {
            type: "text",
            text: `訂單編號：${order.orderId}`,
            size: "sm",
            color: "#666666",
            wrap: true
          },
          {
            type: "separator",
            margin: "md"
          },
          ...rows,
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "總金額",
                weight: "bold",
                size: "lg"
              },
              {
                type: "text",
                text: `$${Number(order.totalAmount).toLocaleString()}`,
                weight: "bold",
                size: "lg",
                align: "end",
                color: "#C82333"
              }
            ]
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "text",
            text: `訂單類別：${order.orderType}`,
            size: "sm",
            wrap: true,
            weight: "bold",
            color: "#111111"
          },
          {
            type: "text",
            text: `訂購人：${order.form.name}`,
            size: "sm",
            wrap: true
          },
          {
            type: "text",
            text: `電話：${order.form.phone}`,
            size: "sm",
            wrap: true
          },
          {
            type: "text",
            text: `地址：${order.form.address}`,
            size: "sm",
            wrap: true
          },
          {
            type: "text",
            text: `預定日期：${order.form.date}`,
            size: "sm",
            wrap: true
          },
          {
            type: "text",
            text: `預定時間：${order.form.time}`,
            size: "sm",
            wrap: true
          },
          {
            type: "text",
            text: `備註：${order.form.note || "無"}`,
            size: "sm",
            wrap: true,
            color: "#CC0000"
          }
        ]
      }
    }
  };
}

export async function sendOrderMessageToLineChat(order, liffReady) {
  if (!liffReady) {
    throw new Error("LIFF 尚未初始化完成");
  }

  if (!liff.isInClient()) {
    throw new Error("目前不是在 LINE App 的 LIFF 視窗內開啟，無法送回聊天室");
  }

  const flexMessage = buildCustomerFlexMessage(order);

  console.log("即將送出的 Flex Message:", safeStringify(flexMessage));

  await liff.sendMessages([flexMessage]);
}

export async function saveOrderToGoogleSheet(order) {
  if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.includes("貼上你的")) {
    throw new Error("尚未設定 GAS_WEB_APP_URL，請貼上 Apps Script /exec 網址");
  }

  // 不再使用 no-cors，改成正常呼叫並讀取後端回應，才能確認是否真的存檔成功。
  // 刻意維持 Content-Type: text/plain，避免觸發瀏覽器 preflight（Google Apps Script 無法處理 OPTIONS 請求）
  let res;
  try {
    res = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(order)
    });
  } catch (networkErr) {
    console.error("儲存訂單時網路異常", networkErr);
    throw new Error("訂單儲存失敗（網路異常），請截圖聯絡店家 0938093816");
  }

  if (!res.ok) {
    throw new Error(`訂單儲存失敗（伺服器回應 ${res.status}），請截圖聯絡店家 0938093816`);
  }

  let data;
  try {
    data = await res.json();
  } catch (parseErr) {
    console.error("無法解析後端回應", parseErr);
    throw new Error("訂單儲存狀態不明，請截圖聯絡店家 0938093816 確認訂單");
  }

  // 後端成功時回傳 { success: true, orderId, totalAmount }
  if (!data || data.success !== true) {
    const reason = data && data.message ? "：" + data.message : "";
    throw new Error("訂單儲存失敗" + reason + "，請截圖聯絡店家 0938093816");
  }

  return data;
}
