import { useState, useEffect, useRef } from "react";
import liff from "@line/liff";
import html2canvas from "html2canvas";

import { MENU, MENU_ITEMS, INITIAL_CART, TAIWAN_ZONES } from "./menu";
import { MY_LIFF_ID, GAS_WEB_APP_URL } from "./config";
import { sendOrderMessageToLineChat, saveOrderToGoogleSheet } from "./api";

import MenuItem from "./components/MenuItem";
import MenuItemWithTwoOptions from "./components/MenuItemWithTwoOptions";
import CartRow from "./components/CartRow";
import ReceiptRow from "./components/ReceiptRow";

export default function App() {
  const [stage, setStage] = useState(1);
  const [orderType, setOrderType] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(true);
  const [tempOrderType, setTempOrderType] = useState(null);

  const [cart, setCart] = useState(INITIAL_CART);
  const [showCartPreview, setShowCartPreview] = useState(false);

  // 後台菜單設定（上架狀態、價格）；null 代表還沒讀到或讀取失敗，這時全部退回本地預設值
  const [remoteMenu, setRemoteMenu] = useState(null);

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

  useEffect(() => {
    async function loadMenuConfig() {
      try {
        // 加時間戳記＋no-store 避免讀到快取的舊上架狀態或舊價格
        const res = await fetch(`${GAS_WEB_APP_URL}?action=getMenu&t=${Date.now()}`, {
          cache: "no-store"
        });
        const data = await res.json();

        if (data && data.success && Array.isArray(data.items)) {
          const map = {};
          data.items.forEach(it => {
            if (it && it.id) {
              map[it.id] = {
                price: Number(it.price),
                enabled: it.enabled !== false,
                name: it.name || "",
                description: it.description,
                order: typeof it.order === "number" && !Number.isNaN(it.order) ? it.order : null
              };
            }
          });
          setRemoteMenu(map);
        }
      } catch (err) {
        // 後台還沒設定好、或讀取失敗時，維持 remoteMenu 為 null，全部退回本地預設值，不影響點餐
        console.warn("讀取後台菜單設定失敗，改用本地預設值", err);
      }
    }

    loadMenuConfig();
  }, []);

  // 取得品項目前實際售價：後台有設定就用後台的，沒有（或讀取失敗）就用 menu.js 的預設值
  const getPrice = (id) => {
    const remote = remoteMenu && remoteMenu[id];
    if (remote && typeof remote.price === "number" && !Number.isNaN(remote.price)) {
      return remote.price;
    }
    return MENU_ITEMS[id] ? MENU_ITEMS[id].price : 0;
  };

  // 取得品項目前是否上架：後台沒有這筆資料時預設為上架，避免後台還沒建好資料時整個菜單消失
  const isItemEnabled = (id) => {
    const remote = remoteMenu && remoteMenu[id];
    return remote ? remote.enabled : true;
  };

  // 兩選項品項（刈包）用第一個選項的 id 代表整張卡片，卡片標題/描述/排序都存在這個 id 底下
  const getPrimaryId = (menuItem) => {
    return menuItem.type === "two-options" ? menuItem.options[0].id : menuItem.id;
  };

  // 取得卡片目前實際的品名、描述、排序：後台有設定就用後台的，沒有就用 menu.js 的預設值
  const getCardMeta = (menuItem, fallbackOrder) => {
    const remote = remoteMenu && remoteMenu[getPrimaryId(menuItem)];
    return {
      name: (remote && remote.name) || menuItem.title,
      description: remote && remote.description !== undefined ? remote.description : menuItem.description,
      order: remote && typeof remote.order === "number" ? remote.order : fallbackOrder
    };
  };

  // 依後台設定的排序值重新排列品項，沒有設定排序的品項維持原本在 menu.js 裡的順序
  const sortedMenu = MENU
    .map((item, idx) => ({ item, order: getCardMeta(item, idx).order }))
    .sort((a, b) => a.order - b.order)
    .map(entry => entry.item);

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
      totalAmount += qty * getPrice(key);
      if (itemInfo.isBao) totalBao += qty;
      if (itemInfo.isPlatter) totalPlatter += qty;
    }
  });

  let isThresholdMet = false;
  let thresholdMsg = "";
  let thresholdShortMsg = "";
  if (orderType === "fulon") {
    isThresholdMet = totalBao >= 30 || totalPlatter >= 3;
    thresholdMsg = "尚未達到淡水福容飯店訂餐門檻：刈包需 30 顆以上，或素滷味拼盤需 3 盤以上。";
    thresholdShortMsg = "未達門檻：刈包 30 顆或拼盤 3 盤";
  } else if (orderType === "other") {
    isThresholdMet = totalBao >= 10 || totalPlatter >= 1;
    thresholdMsg = "尚未達到訂餐門檻：刈包需 10 顆以上，或素滷味拼盤 1 盤即可訂購。";
    thresholdShortMsg = "未達門檻：刈包 10 顆或拼盤 1 盤";
  }

  const soupQty = cart['soup'] || 0;
  const isSoupValid = soupQty === 0 || soupQty >= 10;
  const soupMsg = "補湯需 10 碗以上才可訂購。";

  const isBaoValid = totalBao === 0 || totalBao >= 10;
  const baoMsg = "刈包如需訂購，最少需 10 顆才能製作，請調整數量或不訂購刈包。";

  // 點餐頁預覽面板用的精簡提示，完整說明留在第二頁
  const cartWarnings = [];
  if (!isThresholdMet) cartWarnings.push(thresholdShortMsg);
  if (!isBaoValid) cartWarnings.push("刈包需 10 顆以上");
  if (!isSoupValid) cartWarnings.push("補湯需 10 碗以上");

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

  // 預定日期限制：只能選擇三天後（含）之後的日期
  const getMinOrderDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const minOrderDate = getMinOrderDate();

  const submitOrder = async () => {
    let completeAddress = "";
    if (form.deliveryMethod === "pickup") {
      completeAddress = "自取（板橋區） (將於訂單確認後附上取貨地址)";
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

    if (form.date < minOrderDate) {
      showToastMessage("預定日期請選擇三天後（含）之後的日期喔！");
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

    if (!isBaoValid) {
      showToastMessage("⚠️ " + baoMsg);
      return;
    }

    setIsSubmitting(true);

    const finalOrder = {
      orderId: createClientOrderId(),
      timestamp: formatTimestamp(),
      orderType: orderType === "fulon" ? "淡水福容飯店" : "其他",
      items: { ...cart },
      // 記錄下單當下實際套用的價格，避免完成頁收據被之後的後台改價影響
      prices: Object.fromEntries(Object.keys(cart).map(key => [key, getPrice(key)])),
      form: { ...form, address: completeAddress },
      totalAmount: totalAmount,
      lineStatus: "",
      lineError: ""
    };

    try {
      try {
        await sendOrderMessageToLineChat(finalOrder, liffReady);
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
        <div className="pb-32">
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
            {sortedMenu.map((item, idx) => {
              const meta = getCardMeta(item, idx);

              if (item.type === "two-options") {
                const idA = item.options[0].id;
                const idB = item.options[1].id;
                const enabledA = isItemEnabled(idA);
                const enabledB = isItemEnabled(idB);

                if (!enabledA && !enabledB) return null;

                return (
                  <MenuItemWithTwoOptions
                    key={idA}
                    image={item.image}
                    title={meta.name}
                    optionA={item.options[0].shortName}
                    optionB={item.options[1].shortName}
                    priceA={getPrice(idA)}
                    priceB={getPrice(idB)}
                    enabledA={enabledA}
                    enabledB={enabledB}
                    qtyA={cart[idA]}
                    qtyB={cart[idB]}
                    onMinusA={() => updateQty(idA, -1)}
                    onPlusA={() => updateQty(idA, 1)}
                    onMinusB={() => updateQty(idB, -1)}
                    onPlusB={() => updateQty(idB, 1)}
                  />
                );
              } else {
                if (!isItemEnabled(item.id)) return null;

                return (
                  <MenuItem
                    key={item.id}
                    image={item.image}
                    title={meta.name}
                    description={meta.description}
                    price={getPrice(item.id)}
                    qty={cart[item.id]}
                    onMinus={() => updateQty(item.id, -1)}
                    onPlus={() => updateQty(item.id, 1)}
                  />
                );
              }
            })}
          </div>

          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-20">
            {showCartPreview && totalItems > 0 && (
              <div className="bg-white border-t px-4 py-3 max-h-60 overflow-y-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <h3 className="font-bold text-sm text-gray-700 border-b pb-2 mb-2">已選餐點</h3>

                <div className="text-sm space-y-1">
                  {MENU.map(item => {
                    if (item.type === "two-options") {
                      return item.options.map(opt => {
                        if (cart[opt.id] > 0) {
                          return <CartRow key={opt.id} name={opt.uiName} qty={cart[opt.id]} amount={cart[opt.id] * getPrice(opt.id)} />
                        }
                        return null;
                      });
                    } else {
                      if (cart[item.id] > 0) {
                        return <CartRow key={item.id} name={item.uiName} qty={cart[item.id]} amount={cart[item.id] * getPrice(item.id)} />
                      }
                    }
                    return null;
                  })}
                </div>

                {cartWarnings.length > 0 && (
                  <div className="mt-3 bg-red-50 border border-red-300 text-red-600 text-xs font-bold rounded-lg p-2 text-center">
                    ⚠️ {cartWarnings.join("／")}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white border-t pt-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              <button
                type="button"
                onClick={() => {
                  if (totalItems === 0) return;
                  setShowCartPreview(prev => !prev);
                }}
                className="text-left"
              >
                <div className="text-xs text-gray-400">
                  已選品項數量：{totalItems}
                  {totalItems > 0 && (
                    <span className="ml-1 text-orange-600 font-bold">
                      {showCartPreview ? "收合 ▼" : "查看 ▲"}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-orange-600">${totalAmount}</div>
              </button>
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
                下一步
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 2 && (
        <div className="pb-40 min-h-screen" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
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

              {!isBaoValid && (
                <div className="mt-4 bg-red-50 border border-red-400 p-3 rounded-xl text-red-600 font-bold text-center text-sm shadow-inner animate-pulse">
                  ⚠️ {baoMsg}
                  <br />
                  <span className="text-xs font-normal text-gray-500">
                    目前刈包：{totalBao} 顆
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
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-colors ${form.deliveryMethod === "pickup" ? "bg-orange-600 text-white border-orange-600 shadow-md" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                  >
                    自取（板橋區）
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, deliveryMethod: "lalamove" })}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-colors ${form.deliveryMethod === "lalamove" ? "bg-orange-600 text-white border-orange-600 shadow-md" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
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
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <select
                        value={form.city}
                        onChange={e => setForm({ ...form, city: e.target.value, district: "" })}
                        className="w-full border rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                      >
                        <option value="" disabled>請選擇縣市 *</option>
                        {Object.keys(TAIWAN_ZONES).map(city => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1">
                      <select
                        value={form.district}
                        onChange={e => setForm({ ...form, district: e.target.value })}
                        className="w-full border rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                        disabled={!form.city}
                      >
                        <option value="" disabled>請選擇區域 *</option>
                        {form.city && TAIWAN_ZONES[form.city].map(dist => (
                          <option key={dist} value={dist}>{dist}</option>
                        ))}
                      </select>
                    </div>
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

              {/* 外框改由 div 負責並裁切內容：原生日期/時間 input 有約 170-200px 的最小寬度，
                  並排時會撐破格子，包一層可見外框才能保證兩欄不重疊 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-gray-500 mb-1 pl-1">預定日期 *</label>
                  <div className="border rounded-xl bg-white px-2 py-3 overflow-hidden focus-within:ring-2 focus-within:ring-orange-500">
                    <input
                      type="date"
                      value={form.date}
                      min={minOrderDate}
                      onChange={e => setForm({ ...form, date: e.target.value })}
                      className="block w-full min-w-0 p-0 text-sm bg-transparent border-0 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-gray-500 mb-1 pl-1">預定時間 *</label>
                  <div className="border rounded-xl bg-white px-2 py-3 overflow-hidden focus-within:ring-2 focus-within:ring-orange-500">
                    <input
                      type="time"
                      value={form.time}
                      onChange={e => setForm({ ...form, time: e.target.value })}
                      className="block w-full min-w-0 p-0 text-sm bg-transparent border-0 focus:outline-none"
                    />
                  </div>
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

          <div className="fixed bottom-0 left-0 right-0 bg-white pt-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-w-md mx-auto border-t z-20 shadow-xl">
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
            <p><strong>預定日期：</strong>{orderResult?.form.date}</p>
            <p><strong>預定時間：</strong>{orderResult?.form.time}</p>
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
                      const price = orderResult?.prices?.[opt.id] ?? opt.price;
                      return <ReceiptRow key={opt.id} name={opt.uiName} qty={orderResult.items[opt.id]} price={price} />
                    }
                    return null;
                  });
                } else {
                  if (orderResult?.items[item.id] > 0) {
                    const price = orderResult?.prices?.[item.id] ?? item.price;
                    return <ReceiptRow key={item.id} name={item.uiName} qty={orderResult.items[item.id]} price={price} />
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
