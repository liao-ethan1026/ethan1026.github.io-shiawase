const { useState, useEffect, useRef } = React;

const MY_LIFF_ID = "2010149173-LK0mBdYK";

/**
 * 這裡貼上 Apps Script Web App 的 /exec 網址
 */
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycby4F9gl7ZhdXfIvSJljYIDFMLnjUPtq04PpYvTyvaGNYfnOBVHKvQVhrkAqhQiJS5s1RQ/exec";

// 菜單集中設定區：未來修改價格或新增、刪除品項，只要修改這個 MENU 陣列即可
const MENU = [
  {
    type: "two-options",
    title: "招牌素滷肉刈包",
    image: "./images/bao.png?v=4",
    options: [
      { id: "baoWith", flexName: "素滷肉刈包(加香菜)", uiName: "素滷肉刈包 (加香菜)", shortName: "加香菜", price: 60, isBao: true },
      { id: "baoWithout", flexName: "素滷肉刈包(不香菜)", uiName: "素滷肉刈包 (不香菜)", shortName: "不香菜", price: 60, isBao: true }
    ]
  },
  {
    type: "single",
    id: "platter",
    title: "特製素滷味拼盤",
    flexName: "特製素滷味拼盤",
    uiName: "特製素滷味拼盤",
    description: "大份量聚餐首選",
    image: "./images/platter.png?v=4",
    price: 600,
    isPlatter: true
  },
  {
    type: "single",
    id: "soup",
    title: "素藥膳補湯(一碗)",
    flexName: "素藥膳補湯(一碗)",
    uiName: "素藥膳補湯(一碗)",
    description: "暖胃養生推薦",
    image: "./images/soup.png?v=4",
    price: 60
  },
  {
    type: "single",
    id: "soyMilk",
    title: "非基改豆漿(500cc)",
    flexName: "非基改豆漿(500cc)",
    uiName: "非基改豆漿(500cc)",
    description: "香醇濃郁",
    image: "./images/soymilk.png?v=4",
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

const TAIWAN_ZONES = {
  "台北市": ["中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"],
  "新北市": ["板橋區", "三重區", "中和區", "永和區", "新莊區", "新店區", "土城區", "蘆洲區", "樹林區", "汐止區", "鶯歌區", "三峽區", "淡水區", "瑞芳區", "五股區", "泰山區", "林口區", "深坑區", "石碇區", "坪林區", "三芝區", "石門區", "八里區", "平溪區", "雙溪區", "貢寮區", "金山區", "萬里區", "烏來區"]
};

function App() {
  const [stage, setStage] = useState(1);
  const [orderType, setOrderType] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(true);
  const [tempOrderType, setTempOrderType] = useState(null);

  const [cart, setCart] = useState(INITIAL_CART);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    deliveryMethod: "lalamove",
    city: "",
    district: "",
    addressDetail: "",
    date: "",
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

  const swipeStartX = useRef(null);
  const swipeStartY = useRef(null);

  const handleSwipeStart = (e) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  };

  const handleSwipeEnd = (e) => {
    if (swipeStartX.current === null) return;
    const swipeEndX = e.changedTouches[0].clientX;
    const swipeEndY = e.changedTouches[0].clientY;
    const dx = swipeEndX - swipeStartX.current;
    const dy = swipeEndY - swipeStartY.current;

    // 右滑：從畫面左側邊緣開始(<=50px)，且向右滑動距離>60px，且水平位移大於垂直位移
    if (swipeStartX.current <= 50 && dx > 60 && Math.abs(dx) > Math.abs(dy)) {
      setStage(1);
    }
    swipeStartX.current = null;
    swipeStartY.current = null;
  };

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

  let isThresholdMet = false;
  let thresholdMsg = "";
  if (orderType === "fulon") {
    isThresholdMet = totalBao >= 30 || totalPlatter >= 3;
    thresholdMsg = "尚未達到淡水福容飯店訂餐門檻：刈包需 30 顆以上，或素滷味拼盤需 3 盤以上。";
  } else if (orderType === "other") {
    isThresholdMet = totalBao >= 10 || totalPlatter >= 1;
    thresholdMsg = "尚未達到訂餐門檻：刈包需 10 顆以上，或素滷味拼盤 1 盤即可訂購。";
  }

  const soupQty = cart['soup'] || 0;
  const isSoupValid = soupQty === 0 || soupQty >= 10;
  const soupMsg = "補湯需 10 碗以上才可訂購。";

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
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    
    // 依據訂餐地點設定前綴字首 (F: 福容, O: 其他)
    const prefix = orderType === "fulon" ? "F" : "O";
    
    // 取得電話末三碼。如果沒有填寫，預設補上 000 防呆
    const phoneStr = form.phone || "000";
    const phoneLast3 = phoneStr.slice(-3).padStart(3, "0");

    return `${prefix}${mm}${dd}-${phoneLast3}`;
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
              text: `期望日期：${order.form.date}`,
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
    let completeAddress = "";
    if (form.deliveryMethod === "pickup") {
      completeAddress = "自取 (將於訂單確認後附上取貨地址)";
    } else if (form.deliveryMethod === "fullon") {
      completeAddress = "淡水福容飯店 (大嫂親送)";
    } else {
      if (!form.city || !form.district || !form.addressDetail) {
        showToastMessage("請完整填寫外送地址資訊喔！");
        return;
      }
      completeAddress = form.city + form.district + form.addressDetail;
    }

    if (!form.name || !form.phone || !form.date || !form.time) {
      showToastMessage("請完整填寫姓名、電話與日期時間等聯絡資訊喔！");
      return;
    }

    if (!/^\d{10}$/.test(form.phone)) {
      showToastMessage("請輸入有效的電話號碼！");
      return;
    }

    if (totalItems === 0) {
      showToastMessage("您的購物車還是空的，請先挑選餐點喔！");
      return;
    }

    if (!isThresholdMet) {
      showToastMessage("⚠️ " + thresholdMsg);
      return;
    }

    if (!isSoupValid) {
      showToastMessage("⚠️ " + soupMsg);
      return;
    }

    setIsSubmitting(true);

    const finalOrder = {
      orderId: createClientOrderId(),
      timestamp: formatTimestamp(),
      orderType: orderType === "fulon" ? "淡水福容飯店" : "其他",
      items: { ...cart },
      form: { ...form, address: completeAddress },
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
    <div className="max-w-md mx-auto bg-white min-h-screen relative shadow-lg overflow-x-hidden">
      {toast.show && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-11/12 max-w-sm transition-all duration-300">
          <div className={`p-4 rounded-xl shadow-2xl border flex items-start gap-3 ${toast.isWarning ? "bg-red-50 border-red-200 text-red-800" : "bg-green-50 border-green-200 text-green-800"}`}>
            <div className="text-xl flex-shrink-0">{toast.isWarning ? "⚠️" : "💡"}</div>
            <div className="text-sm font-semibold leading-relaxed whitespace-pre-line">{toast.message}</div>
          </div>
        </div>
      )}

      {showLocationModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-orange-100">
            <h2 className="text-2xl font-black mb-2 text-center text-gray-800">請問您的訂餐地點是？</h2>
            <p className="text-sm text-gray-600 mb-6 font-medium text-center">系統會依照您選擇的地點，自動套用對應的訂餐門檻與取餐方式。</p>

            <div className="space-y-4">
              <button
                onClick={() => setTempOrderType("fulon")}
                className={`w-full text-left p-4 rounded-2xl transition-all shadow-sm relative block cursor-pointer border-2 ${tempOrderType === "fulon" ? "bg-orange-50 border-orange-500 ring-4 ring-orange-200" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}
              >
                <div className="absolute top-0 right-0 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl shadow-sm">
                  大嫂親送
                </div>
                <h3 className={`text-xl font-bold mb-1 mt-1 ${tempOrderType === "fulon" ? "text-orange-800" : "text-gray-800"}`}>淡水福容飯店</h3>
                <p className="text-sm font-bold border-t border-gray-200 pt-2 mt-2 text-gray-700">
                  訂餐門檻：刈包 30 顆以上，或素滷味拼盤 3 盤以上
                </p>
              </button>

              <button
                onClick={() => setTempOrderType("other")}
                className={`w-full text-left p-4 rounded-2xl transition-all shadow-sm block cursor-pointer border-2 ${tempOrderType === "other" ? "bg-orange-50 border-orange-500 ring-4 ring-orange-200" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}
              >
                <h3 className={`text-xl font-bold mb-1 ${tempOrderType === "other" ? "text-orange-800" : "text-gray-800"}`}>其他</h3>
                <p className="text-xs text-gray-600 font-bold mb-2">自取 或 Lalamove（運費自付）</p>
                <p className="text-sm font-bold border-t border-gray-200 pt-2 mt-2 text-gray-700">
                  訂餐門檻：刈包 10 顆以上，素滷味拼盤 1 盤即可訂購
                </p>
              </button>
            </div>

            <button
              onClick={() => {
                if (!tempOrderType) {
                  showToastMessage("請先選擇一個訂餐地點喔！");
                  return;
                }
                setOrderType(tempOrderType);
                setForm(prev => ({ 
                  ...prev, 
                  deliveryMethod: tempOrderType === "fulon" ? "fullon" : "pickup" 
                }));
                setShowLocationModal(false);
              }}
              className={`w-full mt-6 py-4 rounded-xl font-bold text-white shadow-md text-lg transition-all ${tempOrderType ? "bg-orange-600 active:bg-orange-700 hover:bg-orange-500" : "bg-gray-300 cursor-not-allowed"}`}
            >
              確認方案並開始點餐
            </button>

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-3 text-left">
              <p className="text-sm text-blue-800 font-bold">💡 補湯訂購提醒：</p>
              <p className="text-xs text-blue-700 mt-1">若有訂購補湯，補湯數量需達 10 碗以上，訂單才可成立。</p>
            </div>
            
            <p className="text-sm font-bold text-gray-800 mt-6 pt-4 border-t text-center">
              大量/團體活動訂餐請私訊或來電<br />
              <a href="tel:0938093816" className="text-orange-600 text-lg">0938093816</a>
            </p>
          </div>
        </div>
      )}

      {stage === 1 && (
        <div className="pb-24">
          <header className="bg-orange-600 text-white p-4 sticky top-0 z-10 text-center shadow-md">
            <h1 className="text-xl font-bold">大嫂素食刈包線上點餐</h1>
            {orderType && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <div className="bg-orange-800 text-orange-100 text-xs py-1.5 px-3 rounded-full font-bold shadow-inner border border-orange-700">
                  目前訂餐類型：{orderType === "fulon" ? "淡水福容飯店" : "其他"}
                </div>
                <button
                  onClick={() => {
                    setTempOrderType(orderType);
                    setShowLocationModal(true);
                  }}
                  className="bg-white text-orange-600 text-xs py-1.5 px-3 rounded-full font-bold shadow-sm border border-orange-200 active:bg-gray-100"
                >
                  更改方案
                </button>
              </div>
            )}
            <p className="text-xs mt-2 opacity-90">
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
                  showToastMessage("您的購物車還是空的，請先挑選餐點喔！");
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
        <div className="pb-32 min-h-screen" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
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
                  ⚠️ {thresholdMsg}
                  <br />
                  <span className="text-xs font-normal text-gray-500">
                    目前刈包：{totalBao} 顆 / 滷味：{totalPlatter} 盤
                  </span>
                </div>
              )}

              {!isSoupValid && (
                <div className="mt-4 bg-red-50 border border-red-400 p-3 rounded-xl text-red-600 font-bold text-center text-sm shadow-inner animate-pulse">
                  ⚠️ {soupMsg}
                  <br />
                  <span className="text-xs font-normal text-gray-500">
                    目前補湯：{soupQty} 碗
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-gray-700 pl-1">取餐/外送方式</h3>

              {orderType === "fulon" ? (
                <div className="flex gap-2">
                  <div className="flex-1 py-3 rounded-xl text-sm font-bold border border-orange-600 bg-orange-600 text-white text-center shadow-sm">
                    淡水福容飯店 (大嫂親送)
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, deliveryMethod: "pickup" })}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${form.deliveryMethod === "pickup" ? "bg-orange-600 text-white border-orange-600" : "bg-white text-gray-700 border-gray-300"}`}
                  >
                    自取
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, deliveryMethod: "lalamove" })}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${form.deliveryMethod === "lalamove" ? "bg-orange-600 text-white border-orange-600" : "bg-white text-gray-700 border-gray-300"}`}
                  >
                    LALAMOVE
                  </button>
                </div>
              )}

              {orderType === "other" && form.deliveryMethod === "pickup" && (
                <div className="bg-orange-50 text-orange-600 p-3 rounded-xl text-sm font-medium border border-orange-100 text-center shadow-sm">
                  將於訂單確認後附上取貨地址
                </div>
              )}

              {orderType === "fulon" && (
                <div className="bg-orange-50 text-orange-600 p-3 rounded-xl text-sm font-medium border border-orange-100 text-center shadow-sm">
                  大嫂親送不用運費
                </div>
              )}

              {orderType === "other" && form.deliveryMethod === "lalamove" && (
                <div className="bg-orange-50 text-orange-600 p-3 rounded-xl text-sm font-medium border border-orange-100 text-center shadow-sm">
                  Lalamove 運費自付
                </div>
              )}

              <input
                type="text"
                placeholder="聯絡人姓名 *"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500 mt-2"
              />

              <input
                type="tel"
                placeholder="聯絡電話 *"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full border rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />

              {form.deliveryMethod === "lalamove" && (
                <>
                  <div className="flex gap-2">
                    <select
                      value={form.city}
                      onChange={e => setForm({ ...form, city: e.target.value, district: "" })}
                      className="w-1/2 border rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                    >
                      <option value="" disabled>請選擇縣市 *</option>
                      {Object.keys(TAIWAN_ZONES).map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>

                    <select
                      value={form.district}
                      onChange={e => setForm({ ...form, district: e.target.value })}
                      className="w-1/2 border rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                      disabled={!form.city}
                    >
                      <option value="" disabled>請選擇區域 *</option>
                      {form.city && TAIWAN_ZONES[form.city].map(dist => (
                        <option key={dist} value={dist}>{dist}</option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="text"
                    placeholder="送餐詳細地址（路名、段、巷弄、樓層） *"
                    value={form.addressDetail}
                    onChange={e => setForm({ ...form, addressDetail: e.target.value })}
                    className="w-full border rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </>
              )}

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1 pl-1">期望日期 *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full border rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1 pl-1">期望時間 *</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={e => setForm({ ...form, time: e.target.value })}
                    className="w-full border rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                  />
                </div>
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

          <p className="text-red-600 font-bold mb-6 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
            ⚠️ 注意事項：所有餐點都需預訂，接單確認才會製做喔！
          </p>

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
            大嫂素食刈包 訂單出單明細
          </h2>

          <div style={{
            fontSize: "13px",
            lineHeight: "1.8",
            marginTop: "12px"
          }}>
            <p><strong>訂單編號：</strong>{orderResult?.orderId}</p>
            <p><strong>訂餐類別：</strong>{orderResult?.orderType}</p>
            <p><strong>下單時間：</strong>{orderResult?.timestamp}</p>
            <p><strong>客戶姓名：</strong>{orderResult?.form.name}</p>
            <p><strong>聯絡電話：</strong>{orderResult?.form.phone}</p>
            <p><strong>外送地址：</strong>{orderResult?.form.address}</p>
            <p><strong>期望日期：</strong>{orderResult?.form.date}</p>
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
      <SafeImage src={props.image} alt={props.title} className="w-24 h-24 rounded-lg food-img flex-shrink-0" />

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
      <SafeImage src={props.image} alt={props.title} className="w-24 h-24 rounded-lg food-img flex-shrink-0" />

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

function SafeImage({ src, alt, className }) {
  const [show, setShow] = useState(false);
  const [animate, setAnimate] = useState(false);
  const overlayRef = useRef(null);
  const imgRef = useRef(null);

  // 雙指縮放與拖曳狀態
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const lastDist = useRef(null);
  const lastPos = useRef(null);

  // 防白屏核心：徹底封鎖系統級的原生滾動與縮放
  useEffect(() => {
    const node = overlayRef.current;
    if (!node || !show) return;
    
    document.body.style.overflow = 'hidden'; // 禁止網頁底層滾動
    
    const preventNativeScroll = (e) => {
      e.preventDefault(); // 封殺系統預設的滑動與雙指縮放行為（防 Safari 白屏）
    };
    
    node.addEventListener('touchmove', preventNativeScroll, { passive: false });
    return () => {
      document.body.style.overflow = '';
      node.removeEventListener('touchmove', preventNativeScroll);
    };
  }, [show]);

  const handleOpen = () => {
    setShow(true);
    // 復原初始狀態
    setScale(1);
    setPos({ x: 0, y: 0 });
    lastDist.current = null;
    lastPos.current = null;
    setTimeout(() => setAnimate(true), 10);
  };

  const closePreview = () => {
    setAnimate(false);
    setTimeout(() => {
      setShow(false);
      setScale(1);
      setPos({ x: 0, y: 0 });
    }, 300);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      lastDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1) {
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      // 雙指縮放
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastDist.current && lastDist.current > 0) {
        const delta = dist / lastDist.current;
        setScale(s => {
          let next = s * delta;
          if (isNaN(next)) return s;
          return Math.min(Math.max(1, next), 3.5); // 最大3.5倍
        });
      }
      lastDist.current = dist;
    } else if (e.touches.length === 1) {
      // 支援單指拖曳找細節
      if (!lastPos.current) {
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return;
      }
      
      const curX = e.touches[0].clientX;
      const curY = e.touches[0].clientY;
      const dx = curX - lastPos.current.x;
      const dy = curY - lastPos.current.y;
      
      if (!isNaN(dx) && !isNaN(dy)) {
        setPos(p => {
          let nextX = p.x + dx;
          let nextY = p.y + dy;
          
          // 動態限制拖曳範圍：精準計算照片邊界，不讓黑底額外露出來
          if (imgRef.current) {
            const w = imgRef.current.offsetWidth;
            const h = imgRef.current.offsetHeight;
            const maxX = Math.max(0, (w * scale - w) / 2);
            const maxY = Math.max(0, (h * scale - h) / 2);
            nextX = Math.max(-maxX, Math.min(maxX, nextX));
            nextY = Math.max(-maxY, Math.min(maxY, nextY));
          }
          
          return { x: nextX, y: nextY };
        });
      }
      lastPos.current = { x: curX, y: curY };
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length === 0) {
      lastDist.current = null;
      lastPos.current = null;
      // 判斷如果縮放小於等於原尺寸1倍，自動吸附回畫面正中間
      if (scale <= 1) {
        setPos({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1) {
      // 兩指變一指時，讓那一指重新歸零，防瞬間暴衝
      lastDist.current = null;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`${className} select-none cursor-pointer`}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', WebkitUserDrag: 'none' }}
        draggable="false"
        onContextMenu={(e) => e.preventDefault()}
        onClick={handleOpen}
      />
      {show && (
        <div
          ref={overlayRef}
          className={`fixed top-0 bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-[100] flex items-center justify-center bg-black/95 transition-opacity duration-300 touch-none overflow-hidden ${animate ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className={`w-full h-full flex flex-col items-center justify-center transition-transform duration-300 ease-out ${animate ? 'scale-100' : 'scale-[0.98]'}`}>
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              className="max-w-full max-h-[80vh] object-contain select-none"
              style={{
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                WebkitUserDrag: 'none',
                willChange: 'transform',
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${scale})`
              }}
              draggable="false"
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
          <div
            onClick={closePreview}
            className="absolute top-6 right-6 text-gray-800 bg-white/90 active:bg-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-pointer z-[110]"
          >
            ✕
          </div>
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);