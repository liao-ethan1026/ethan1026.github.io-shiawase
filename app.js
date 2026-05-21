const { useState, useEffect } = React;

const MY_LIFF_ID = "2010149173-LK0mBdYK";

/**
 * 這裡貼上 Apps Script Web App 的 /exec 網址
 */
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycby4F9gl7ZhdXfIvSJljYIDFMLnjUPtq04PpYvTyvaGNYfnOBVHKvQVhrkAqhQiJS5s1RQ/exec";

// 菜單集中設定區：未來修改價格或新增、刪除品項，只要修改這個 MENU 陣列即可
const MENU = [
  {
    type: "two-options",
    title: "招牌素刈包",
    image: "https://images.unsplash.com/photo-1582450871972-ab5ca641643d?auto=format&fit=crop&w=300&q=80",
    options: [
      { id: "baoWith", flexName: "素刈包(加香菜)", uiName: "素刈包 (加香菜)", shortName: "加香菜", price: 60, isBao: true },
      { id: "baoWithout", flexName: "素刈包(不香菜)", uiName: "素刈包 (不香菜)", shortName: "不香菜", price: 60, isBao: true }
    ]
  },
  {
    type: "single",
    id: "platter",
    title: "特製滷味拼盤",
    flexName: "特製滷味拼盤",
    uiName: "特製滷味拼盤",
    description: "大份量聚餐首選",
    image: "https://images.unsplash.com/photo-1626804475297-41609ea004eb?auto=format&fit=crop&w=300&q=80",
    price: 600,
    isPlatter: true
  },
  {
    type: "single",
    id: "soup",
    title: "素補湯",
    flexName: "素補湯",
    uiName: "素補湯",
    description: "暖胃養生推薦",
    image: "https://images.unsplash.com/photo-1548943487-a2e4d43b2fc4?auto=format&fit=crop&w=300&q=80",
    price: 60
  },
  {
    type: "single",
    id: "soyMilk",
    title: "豆漿 (常溫)",
    flexName: "豆漿(常溫)",
    uiName: "豆漿 (常溫)",
    description: "香醇濃郁",
    image: "https://images.unsplash.com/photo-1598918451871-331206f477cc?auto=format&fit=crop&w=300&q=80",
    price: 30
  }
];

// 用來方便查找資料的字典
const MENU_ITEMS = {};
const INITIAL_CART = {};

MENU.forEach(item => {
  if (item.type === "two-options") {
    item.options.forEach(opt => {
      MENU_ITEMS[opt.id] = opt;
      INITIAL_CART[opt.id] = 0;
    });
  } else {
    MENU_ITEMS[item.id] = item;
    INITIAL_CART[item.id] = 0;
  }
});

function App() {
  const [stage, setStage] = useState(1);
  const [showAnnounce, setShowAnnounce] = useState(true);

  const [cart, setCart] = useState(INITIAL_CART);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    time: "",
    note: ""
  });

  const [liffReady, setLiffReady] = useState(false);
  const [isLineClient, setIsLineClient] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [receiptImg, setReceiptImg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({
    show: false,
    message: "",
    isWarning: true
  });

  useEffect(() => {
    async function initLiff() {
      try {
        await liff.init({
          liffId: MY_LIFF_ID
        });

        const inClient = liff.isInClient();

        console.log("LIFF 初始化完成");
        console.log("isInClient:", inClient);
        console.log("isLoggedIn:", liff.isLoggedIn());
        console.log("context:", liff.getContext ? liff.getContext() : null);

        setLiffReady(true);
        setIsLineClient(inClient);

        if (!inClient) {
          showToastMessage("⚠️ 目前不是從 LINE App 開啟，可以測試點餐，但無法回傳 LINE 聊天室。");
          return;
        }

        if (liff.isLoggedIn()) {
          liff.getProfile()
            .then(profile => {
              setForm(prev => ({
                ...prev,
                name: profile.displayName || prev.name
              }));
            })
            .catch(err => {
              console.error("無法取得 LINE Profile", err);
            });
        }

      } catch (err) {
        console.error("LIFF 初始化失敗", err);
        setLiffReady(false);
        setIsLineClient(false);
        showToastMessage("⚠️ LIFF 初始化失敗：" + (err.message || String(err)));
      }
    }

    initLiff();
  }, []);

  const showToastMessage = (msg, isWarn = true) => {
    setToast({
      show: true,
      message: msg,
      isWarning: isWarn
    });

    setTimeout(() => {
      setToast({
        show: false,
        message: "",
        isWarning: true
      });
    }, 5000);
  };

  let totalBao = 0;
  let totalPlatter = 0;
  let totalAmount = 0;
  let totalItems = 0;

  Object.keys(cart).forEach(key => {
    const qty = cart[key];
    const itemInfo = MENU_ITEMS[key];
    if (qty > 0) {
      totalItems += qty;
      totalAmount += qty * itemInfo.price;
      if (itemInfo.isBao) totalBao += qty;
      if (itemInfo.isPlatter) totalPlatter += qty;
    }
  });

  const isThresholdMet = totalBao >= 30 || totalPlatter >= 3;

  const updateQty = (key, delta) => {
    setCart(prev => ({
      ...prev,
      [key]: Math.max(0, prev[key] + delta)
    }));
  };

  const pad = (num) => {
    return String(num).padStart(2, "0");
  };

  const createClientOrderId = () => {
    const now = new Date();

    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const mi = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    const random = Math.floor(1000 + Math.random() * 9000);

    return `${yyyy}${mm}${dd}-${hh}${mi}${ss}-${random}`;
  };

  const formatTimestamp = () => {
    const now = new Date();

    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const mi = pad(now.getMinutes());
    const ss = pad(now.getSeconds());

    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  };

  function safeStringify(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return String(value);
    }
  }

  const buildCustomerFlexMessage = (order) => {
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
      altText: "幸福蔬食訂單明細",
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
              text: "幸福蔬食 訂單明細",
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
              text: `期望時間：${order.form.time}`,
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
  };

  async function sendOrderMessageToLineChat(order) {
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

  async function saveOrderToGoogleSheet(order) {
    if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.includes("貼上你的")) {
      throw new Error("尚未設定 GAS_WEB_APP_URL，請貼上 Apps Script /exec 網址");
    }

    await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(order)
    });
  }

  const submitOrder = async () => {
    if (!form.name || !form.phone || !form.address || !form.time) {
      showToastMessage("⚠️ 請完整填寫外送聯絡資訊（姓名、電話、地址與時間皆為必填喔！）");
      return;
    }

    if (totalItems === 0) {
      showToastMessage("⚠️ 您的購物車還是空的，請先挑選餐點喔！");
      return;
    }

    if (!isThresholdMet) {
      showToastMessage("⚠️ 未達外送門檻：刈包最少 30 顆，或滷味最少 3 盤才可以送單喔！");
      return;
    }

    setIsSubmitting(true);

    const finalOrder = {
      orderId: createClientOrderId(),
      timestamp: formatTimestamp(),
      items: { ...cart },
      form: { ...form },
      totalAmount: totalAmount,
      lineStatus: "",
      lineError: ""
    };

    try {
      try {
        await sendOrderMessageToLineChat(finalOrder);
        finalOrder.lineStatus = "顧客端已回傳 Flex Message";
        finalOrder.lineError = "";
      } catch (lineErr) {
        console.error("LINE 聊天室回傳失敗", lineErr);
        finalOrder.lineStatus = "顧客端回傳失敗";
        finalOrder.lineError = lineErr.message || String(lineErr);

        showToastMessage("⚠️ LINE 聊天室回傳失敗，但仍會儲存訂單：" + finalOrder.lineError);
      }

      await saveOrderToGoogleSheet(finalOrder);

      setOrderResult(finalOrder);
      setStage(3);

      setTimeout(() => {
        generateReceipt();
      }, 500);

    } catch (err) {
      console.error("送出訂單失敗", err);
      showToastMessage("❌ 送出失敗：" + (err.message || String(err)));

    } finally {
      setIsSubmitting(false);
    }
  };

  const generateReceipt = () => {
    const el = document.getElementById("receipt-container");

    if (!el) return;

    html2canvas(el, {
      scale: 2
    }).then(canvas => {
      setReceiptImg(canvas.toDataURL("image/png"));
    });
  };

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen relative shadow-lg">
      {toast.show && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-11/12 max-w-sm transition-all duration-300">
          <div className={`p-4 rounded-xl shadow-2xl border flex items-start gap-3 ${toast.isWarning ? "bg-red-50 border-red-200 text-red-800" : "bg-green-50 border-green-200 text-green-800"}`}>
            <div className="text-xl flex-shrink-0">{toast.isWarning ? "⚠️" : "💡"}</div>
            <div className="text-sm font-semibold leading-relaxed whitespace-pre-line">{toast.message}</div>
          </div>
        </div>
      )}

      {showAnnounce && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 text-center shadow-2xl max-w-sm w-full border border-orange-100">
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">📢</div>
            <h2 className="text-xl font-bold mb-3 text-gray-800">幸福蔬食 外送公告</h2>
            <div className="text-sm text-gray-600 space-y-2 mb-6 text-left bg-gray-50 p-4 rounded-xl border">
              <p className="font-semibold text-center text-gray-700 mb-1">本店外送需達以下任一門檻才接單：</p>
              <p className="text-orange-600 font-bold">📍 方案 A：刈包總數量大於等於 30 顆</p>
              <p className="text-orange-600 font-bold">📍 方案 B：特製滷味拼盤大於等於 3 盤</p>
              <p className="text-xs text-gray-400 pt-2 text-center border-t">您可以先挑選餐點，系統將在結帳時自動審核門檻</p>
            </div>
            <button
              onClick={() => setShowAnnounce(false)}
              className="w-full bg-orange-600 text-white font-bold py-3.5 rounded-xl active:bg-orange-700 shadow-md"
            >
              同意並開始點餐
            </button>
          </div>
        </div>
      )}

      {stage === 1 && (
        <div className="pb-24">
          <header className="bg-orange-600 text-white p-4 sticky top-0 z-10 text-center shadow-md">
            <h1 className="text-xl font-bold">幸福蔬食線上點餐</h1>
            <p className="text-xs mt-1 opacity-90">
              {liffReady ? (isLineClient ? "LINE 已連線" : "非 LINE 測試模式") : "LINE 初始化中..."}
            </p>
          </header>

          <div className="p-4 space-y-4">
            {MENU.map((item, idx) => {
              if (item.type === "two-options") {
                return (
                  <MenuItemWithTwoOptions
                    key={idx}
                    image={item.image}
                    title={item.title}
                    optionA={item.options[0].shortName}
                    optionB={item.options[1].shortName}
                    priceA={item.options[0].price}
                    priceB={item.options[1].price}
                    qtyA={cart[item.options[0].id]}
                    qtyB={cart[item.options[1].id]}
                    onMinusA={() => updateQty(item.options[0].id, -1)}
                    onPlusA={() => updateQty(item.options[0].id, 1)}
                    onMinusB={() => updateQty(item.options[1].id, -1)}
                    onPlusB={() => updateQty(item.options[1].id, 1)}
                  />
                );
              } else {
                return (
                  <MenuItem
                    key={item.id}
                    image={item.image}
                    title={item.title}
                    description={item.description}
                    price={item.price}
                    qty={cart[item.id]}
                    onMinus={() => updateQty(item.id, -1)}
                    onPlus={() => updateQty(item.id, 1)}
                  />
                );
              }
            })}
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 max-w-md mx-auto z-20 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div>
              <div className="text-xs text-gray-400">已選品項數量：{totalItems}</div>
              <div className="text-2xl font-bold text-orange-600">${totalAmount}</div>
            </div>
            <button
              onClick={() => {
                if (totalItems === 0) {
                  showToastMessage("⚠️ 您的購物車還是空的，請先挑選餐點喔！");
                  return;
                }

                setStage(2);
              }}
              className="px-8 py-3.5 bg-orange-600 active:bg-orange-700 text-white rounded-xl font-bold shadow-md"
            >
              查看確認餐點
            </button>
          </div>
        </div>
      )}

      {stage === 2 && (
        <div className="pb-32">
          <header className="bg-orange-600 text-white p-4 sticky top-0 z-10 flex items-center shadow-md">
            <button onClick={() => setStage(1)} className="text-white p-2 font-bold text-lg">← 返回</button>
            <h1 className="text-xl font-bold ml-4">確認餐點明細</h1>
          </header>

          <div className="p-4 space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 shadow-sm">
              <h3 className="font-bold border-b pb-2 mb-2 text-gray-700">點餐清單</h3>

              <div className="text-sm space-y-2">
                {MENU.map(item => {
                  if (item.type === "two-options") {
                    return item.options.map(opt => {
                      if (cart[opt.id] > 0) {
                        return <CartRow key={opt.id} name={opt.uiName} qty={cart[opt.id]} amount={cart[opt.id] * opt.price} />
                      }
                      return null;
                    });
                  } else {
                    if (cart[item.id] > 0) {
                      return <CartRow key={item.id} name={item.uiName} qty={cart[item.id]} amount={cart[item.id] * item.price} />
                    }
                  }
                  return null;
                })}
              </div>

              <div className="flex justify-between pt-3 mt-2 font-bold text-lg text-orange-600">
                <span>最終結帳金額</span>
                <span>${totalAmount}</span>
              </div>

              {!isThresholdMet && (
                <div className="mt-4 bg-red-50 border border-red-400 p-3 rounded-xl text-red-600 font-bold text-center text-sm shadow-inner animate-pulse">
                  ⚠️ 外送未達標：刈包最少 30 顆，或滷味最少 3 盤才可以送單喔！
                  <br />
                  <span className="text-xs font-normal text-gray-500">
                    目前刈包：{totalBao} 顆 / 滷味：{totalPlatter} 盤
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-gray-700 pl-1">外送聯絡資訊</h3>

              <input
                type="text"
                placeholder="聯絡人姓名 *"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />

              <input
                type="tel"
                placeholder="聯絡電話 *"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full border rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />

              <input
                type="text"
                placeholder="送餐完整地址 *"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full border rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 pl-1">期望送餐時間 *</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={e => setForm({ ...form, time: e.target.value })}
                  className="w-full border rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 pl-1">備註欄位</label>
                <textarea
                  placeholder="例如：送抵前請先打電話、不吃辣、需自備零錢找不開..."
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  className="w-full border rounded-xl p-3.5 h-24 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white resize-none"
                />
              </div>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-white p-4 max-w-md mx-auto border-t z-20 shadow-xl">
            <button
              onClick={submitOrder}
              disabled={isSubmitting}
              className={`w-full py-4 rounded-xl font-bold text-white shadow-md text-lg transition-all ${isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-orange-600 active:bg-orange-700"}`}
            >
              {isSubmitting ? "正在發送訂單中..." : "確認餐點並送出"}
            </button>
          </div>
        </div>
      )}

      {stage === 3 && (
        <div className="p-6 text-center min-h-screen flex flex-col justify-center items-center bg-gray-50">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">✓</div>
          <h2 className="text-2xl font-bold mb-1 text-gray-800">點餐成功</h2>
          <p className="text-gray-500 font-medium text-sm mb-1">
            您的訂單編號：{orderResult?.orderId}
          </p>

          <div className="w-full shadow-2xl border border-gray-200 rounded-2xl overflow-hidden bg-white mb-6 mt-4">
            {receiptImg ? (
              <img src={receiptImg} alt="實體訂單明細" className="w-full h-auto" />
            ) : (
              <div className="p-12 text-gray-400 text-sm">正在繪製出單明細...</div>
            )}
          </div>

          <button
            onClick={() => {
              if (liff.isInClient()) {
                liff.closeWindow();
              } else {
                location.reload();
              }
            }}
            className="w-full bg-gray-800 text-white font-bold py-4 rounded-xl shadow-md active:bg-gray-900 text-md"
          >
            {liff.isInClient() ? "完成並關閉" : "返回重新點餐"}
          </button>
        </div>
      )}

      {stage === 3 && (
        <div id="receipt-container">
          <h2 style={{
            textAlign: "center",
            borderBottom: "2px solid black",
            paddingBottom: "10px",
            fontSize: "20px",
            fontWeight: "bold",
            letterSpacing: "2px"
          }}>
            幸福蔬食 訂單出單明細
          </h2>

          <div style={{
            fontSize: "13px",
            lineHeight: "1.8",
            marginTop: "12px"
          }}>
            <p><strong>訂單編號：</strong>{orderResult?.orderId}</p>
            <p><strong>下單時間：</strong>{orderResult?.timestamp}</p>
            <p><strong>客戶姓名：</strong>{orderResult?.form.name}</p>
            <p><strong>聯絡電話：</strong>{orderResult?.form.phone}</p>
            <p><strong>外送地址：</strong>{orderResult?.form.address}</p>
            <p><strong>期望時間：</strong>{orderResult?.form.time}</p>
            <p><strong>特別備註：</strong><span style={{ color: "red", fontWeight: "bold" }}>{orderResult?.form.note || "無"}</span></p>
          </div>

          <table style={{
            width: "100%",
            marginTop: "15px",
            borderCollapse: "collapse",
            fontSize: "13px"
          }}>
            <thead>
              <tr style={{ borderBottom: "1px solid black", textAlign: "left" }}>
                <th style={{ padding: "6px 0" }}>餐點品項名稱</th>
                <th style={{ padding: "6px 0", textAlign: "center" }}>數量</th>
                <th style={{ padding: "6px 0", textAlign: "right" }}>小計</th>
              </tr>
            </thead>

            <tbody>
              {MENU.map(item => {
                if (item.type === "two-options") {
                  return item.options.map(opt => {
                    if (orderResult?.items[opt.id] > 0) {
                      return <ReceiptRow key={opt.id} name={opt.uiName} qty={orderResult.items[opt.id]} price={opt.price} />
                    }
                    return null;
                  });
                } else {
                  if (orderResult?.items[item.id] > 0) {
                    return <ReceiptRow key={item.id} name={item.uiName} qty={orderResult.items[item.id]} price={item.price} />
                  }
                }
                return null;
              })}
            </tbody>

            <tfoot>
              <tr style={{ borderTop: "2px solid black", fontWeight: "bold" }}>
                <td colSpan="2" style={{ padding: "12px 0", fontSize: "14px" }}>應收總金額</td>
                <td style={{ padding: "12px 0", textAlign: "right", fontSize: "18px", color: "black" }}>
                  ${orderResult?.totalAmount}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function MenuItemWithTwoOptions(props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-3 flex gap-4">
      <img src={props.image} alt={props.title} className="w-24 h-24 rounded-lg food-img flex-shrink-0" />

      <div className="flex-1 flex flex-col justify-center">
        <h2 className="text-lg font-bold text-gray-800 mb-2">{props.title}</h2>

        <div className="flex justify-between items-center mb-2">
          <div className="text-sm text-gray-600">
            {props.optionA} <span className="text-orange-600 font-bold">${props.priceA}</span>
          </div>

          <QtyControl qty={props.qtyA} onMinus={props.onMinusA} onPlus={props.onPlusA} />
        </div>

        <div className="flex justify-between items-center border-t border-gray-100 pt-2">
          <div className="text-sm text-gray-600">
            {props.optionB} <span className="text-orange-600 font-bold">${props.priceB}</span>
          </div>

          <QtyControl qty={props.qtyB} onMinus={props.onMinusB} onPlus={props.onPlusB} />
        </div>
      </div>
    </div>
  );
}

function MenuItem(props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-3 flex gap-4">
      <img src={props.image} alt={props.title} className="w-24 h-24 rounded-lg food-img flex-shrink-0" />

      <div className="flex-1 flex flex-col justify-center">
        <h2 className="text-lg font-bold text-gray-800">{props.title}</h2>
        <p className="text-xs text-gray-400 mb-2">{props.description}</p>

        <div className="flex justify-between items-center mt-auto">
          <span className="text-orange-600 font-bold">${props.price}</span>
          <QtyControl qty={props.qty} onMinus={props.onMinus} onPlus={props.onPlus} />
        </div>
      </div>
    </div>
  );
}

function QtyControl({ qty, onMinus, onPlus }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onMinus}
        className="w-8 h-8 rounded-full bg-gray-100 font-bold text-lg flex items-center justify-center text-gray-600"
      >
        -
      </button>

      <span className="font-bold text-md w-4 text-center">{qty}</span>

      <button
        onClick={onPlus}
        className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold text-lg flex items-center justify-center"
      >
        +
      </button>
    </div>
  );
}

function CartRow({ name, qty, amount }) {
  return (
    <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
      <span>{name} x {qty}</span>
      <span className="font-medium">${amount}</span>
    </div>
  );
}

function ReceiptRow({ name, qty, price }) {
  return (
    <tr>
      <td style={{ padding: "6px 0" }}>{name}</td>
      <td align="center">{qty}</td>
      <td style={{ textAlign: "right" }}>${qty * price}</td>
    </tr>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);