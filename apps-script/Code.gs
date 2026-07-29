/**
 * 幸福蔬食 - Google Sheets API 後端
 * 給 GitHub Pages 前端 fetch() 使用
 *
 * 這版不負責顯示網頁。
 * 只負責：
 * 1. 接收 GitHub Pages 傳來的訂單資料
 * 2. 後端再次驗證
 * 3. 後端重新計算金額（價格讀自「菜單設定」分頁，管理後台改價會立即反映在這裡）
 * 4. 寫入 Google Sheets
 * 5. 提供菜單設定的讀取（doGet ?action=getMenu）與寫入（doPost action=updateMenu，給後台管理頁用）
 *
 * ⚠️ 此檔案僅為版本備份紀錄，實際執行的是 Google Apps Script 上的版本。
 *    修改後請到 Apps Script 貼上並「管理部署作業 → 編輯 → 新版本」重新部署（網址不變）。
 *
 * ⚠️ 這個檔案會被上傳到公開的 GitHub repo，
 *    真正的管理密碼不寫在程式碼裡，改存在 Apps Script 的「指令碼屬性」
 *    （專案設定 → 指令碼屬性），屬性名稱設為 ADMIN_PASSCODE。
 *    這樣密碼完全不出現在程式碼檔案裡，不管這份檔案怎麼被複製或上傳都不會外流。
 */

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Rde3eDe6evLc4DvxNNzOWNjDKVdRuR_6oND7xgs_k0Y/edit';
const SHEET_NAME = '訂單';
const MENU_SHEET_NAME = '菜單設定';

// 從「指令碼屬性」讀取管理密碼（屬性名稱：ADMIN_PASSCODE），沒設定就回傳空字串
function getAdminPasscode_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_PASSCODE') || '';
}

// 「菜單設定」分頁還沒建立時，用這組預設值自動建立（跟目前 menu.js 的品項一致）
const DEFAULT_MENU = [
  { id: 'baoWith', name: '素滷肉刈包(加香菜)', price: 60, enabled: true },
  { id: 'baoWithout', name: '素滷肉刈包(不香菜)', price: 60, enabled: true },
  { id: 'platter', name: '特製素滷味拼盤', price: 600, enabled: true },
  { id: 'soup', name: '素藥膳補湯(一碗)', price: 60, enabled: true },
  { id: 'soyMilk', name: '非基改豆漿(500cc)', price: 30, enabled: true }
];

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'getMenu') {
    return jsonOutput({
      success: true,
      items: getMenuConfig()
    });
  }

  return ContentService
    .createTextOutput('幸福蔬食訂單 API 運作中')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    if (!e || !e.postData || !e.postData.contents) {
      return jsonOutput({
        success: false,
        message: '沒有收到資料'
      });
    }

    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action || 'submitOrder';

    if (action === 'updateMenu') {
      return handleUpdateMenu(requestData);
    }

    return handleSubmitOrder(requestData);

  } catch (error) {
    return jsonOutput({
      success: false,
      message: error.toString()
    });

  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function handleSubmitOrder(orderData) {
  const items = normalizeItems(orderData.items || {});
  const form = normalizeForm(orderData.form || {});

  // 帶入訂餐地點（淡水福容飯店 / 其他），套用對應門檻
  const validation = validateOrder(items, form, orderData.orderType);

  if (!validation.success) {
    return jsonOutput(validation);
  }

  const prices = getPricesMap();
  const totalAmount = calculateTotalAmount(items, prices);
  const details = buildOrderDetails(items);

  const now = new Date();
  const timestamp = orderData.timestamp || Utilities.formatDate(now, 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  const orderId = orderData.orderId || createFallbackOrderId(now);

  const lineStatus = orderData.lineStatus || '未提供';
  const lineError = orderData.lineError || '';

  const result = writeToSheet({
    timestamp,
    orderId,
    form,
    items,
    details,
    totalAmount,
    lineStatus,
    lineError
  });

  if (!result.success) {
    return jsonOutput({
      success: false,
      message: result.error
    });
  }

  return jsonOutput({
    success: true,
    orderId,
    totalAmount
  });
}

function handleUpdateMenu(requestData) {
  const adminPasscode = getAdminPasscode_();

  if (!adminPasscode) {
    return jsonOutput({
      success: false,
      message: '後台尚未設定管理密碼，請先在 Apps Script 的「指令碼屬性」設定 ADMIN_PASSCODE'
    });
  }

  if (requestData.passcode !== adminPasscode) {
    return jsonOutput({
      success: false,
      message: '管理密碼錯誤'
    });
  }

  const items = Array.isArray(requestData.items) ? requestData.items : [];

  try {
    writeMenuConfig(items);
    return jsonOutput({ success: true });
  } catch (error) {
    return jsonOutput({
      success: false,
      message: error.toString()
    });
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeItems(items) {
  return {
    baoWith: Math.max(0, Number(items.baoWith || 0)),
    baoWithout: Math.max(0, Number(items.baoWithout || 0)),
    soup: Math.max(0, Number(items.soup || 0)),
    soyMilk: Math.max(0, Number(items.soyMilk || 0)),
    platter: Math.max(0, Number(items.platter || 0))
  };
}

function normalizeForm(form) {
  return {
    name: String(form.name || '').trim(),
    phone: String(form.phone || '').trim(),
    address: String(form.address || '').trim(),
    time: String(form.time || '').trim(),
    note: String(form.note || '').trim()
  };
}

function validateOrder(items, form, orderType) {
  if (!form.name || !form.phone || !form.address || !form.time) {
    return {
      success: false,
      message: '聯絡資訊填寫不完整'
    };
  }

  const totalBao = items.baoWith + items.baoWithout;
  const totalPlatter = items.platter;
  const totalItems = totalBao + items.soup + items.soyMilk + totalPlatter;

  if (totalItems <= 0) {
    return {
      success: false,
      message: '購物車是空的'
    };
  }

  // 依訂餐地點套用不同門檻（與前端一致）
  // 淡水福容飯店：刈包 30 顆以上，或滷味拼盤 3 盤以上
  // 其他：刈包 10 顆以上，或滷味拼盤 1 盤以上
  const isFulon = orderType === '淡水福容飯店';

  if (isFulon) {
    if (totalBao < 30 && totalPlatter < 3) {
      return {
        success: false,
        message: '未達淡水福容飯店送單門檻：刈包至少 30 顆，或滷味拼盤至少 3 盤'
      };
    }
  } else {
    if (totalBao < 10 && totalPlatter < 1) {
      return {
        success: false,
        message: '未達送單門檻：刈包至少 10 顆，或滷味拼盤至少 1 盤'
      };
    }
  }

  // 補湯需 10 碗以上才可訂購（0 碗代表沒點，可通過）
  if (items.soup > 0 && items.soup < 10) {
    return {
      success: false,
      message: '補湯需 10 碗以上才可訂購'
    };
  }

  return { success: true };
}

function calculateTotalAmount(items, prices) {
  return (
    items.baoWith * prices.baoWith +
    items.baoWithout * prices.baoWithout +
    items.soup * prices.soup +
    items.soyMilk * prices.soyMilk +
    items.platter * prices.platter
  );
}

function buildOrderDetails(items) {
  const details = [];

  if (items.baoWith > 0) details.push(`素刈包(加香菜) x ${items.baoWith}`);
  if (items.baoWithout > 0) details.push(`素刈包(不香菜) x ${items.baoWithout}`);
  if (items.soup > 0) details.push(`素補湯 x ${items.soup}`);
  if (items.soyMilk > 0) details.push(`豆漿(常溫) x ${items.soyMilk}`);
  if (items.platter > 0) details.push(`特製滷味拼盤 x ${items.platter}`);

  return details.join('\n');
}

function createFallbackOrderId(now) {
  const dateStr = Utilities.formatDate(now, 'Asia/Taipei', 'yyyyMMdd');
  const timeStr = Utilities.formatDate(now, 'Asia/Taipei', 'HHmmss');
  const randomStr = Math.floor(1000 + Math.random() * 9000);

  return `${dateStr}-${timeStr}-${randomStr}`;
}

function writeToSheet(data) {
  try {
    const ss = SpreadsheetApp.openByUrl(SHEET_URL);
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);

      sheet.appendRow([
        '下單時間',
        '訂單編號',
        '聯絡人',
        '電話',
        '外送地址',
        '期望送達時間',
        '備註',
        '刈包(加香菜)',
        '刈包(不香菜)',
        '素補湯',
        '豆漿',
        '滷味拼盤',
        '餐點內容',
        '總金額',
        'LINE回傳狀態',
        '錯誤訊息'
      ]);
    }

    sheet.appendRow([
      data.timestamp,
      data.orderId,
      data.form.name,
      data.form.phone,
      data.form.address,
      data.form.time,
      data.form.note || '無',
      data.items.baoWith,
      data.items.baoWithout,
      data.items.soup,
      data.items.soyMilk,
      data.items.platter,
      data.details,
      data.totalAmount,
      data.lineStatus,
      data.lineError
    ]);

    return { success: true };

  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ---- 以下為「菜單設定」分頁相關：後台管理頁的上架狀態與價格都存在這裡 ----

function getMenuSheet_() {
  const ss = SpreadsheetApp.openByUrl(SHEET_URL);
  let sheet = ss.getSheetByName(MENU_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(MENU_SHEET_NAME);
    sheet.appendRow(['品項ID', '顯示名稱', '價格', '上架']);

    DEFAULT_MENU.forEach(function (it) {
      sheet.appendRow([it.id, it.name, it.price, it.enabled]);
    });
  }

  return sheet;
}

function getMenuConfig() {
  const sheet = getMenuSheet_();
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1); // 去掉標題列

  return rows
    .filter(function (r) { return r[0]; })
    .map(function (r) {
      return {
        id: String(r[0]),
        name: String(r[1] || ''),
        price: Number(r[2]) || 0,
        enabled: String(r[3]).toUpperCase() !== 'FALSE'
      };
    });
}

function getPricesMap() {
  const map = {};

  // 先用寫死的預設值當備援，避免「菜單設定」分頁缺資料時算不出金額
  DEFAULT_MENU.forEach(function (it) {
    map[it.id] = it.price;
  });

  getMenuConfig().forEach(function (it) {
    map[it.id] = it.price;
  });

  return map;
}

function writeMenuConfig(items) {
  const sheet = getMenuSheet_();
  const values = sheet.getDataRange().getValues();

  items.forEach(function (item) {
    if (!item || !item.id) return;

    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(item.id)) {
        rowIndex = i;
        break;
      }
    }

    const price = Number(item.price) || 0;
    const enabled = item.enabled !== false;

    if (rowIndex === -1) {
      // 找不到這個 ID 就新增一列（例如未來在 menu.js 新增品項時）
      sheet.appendRow([item.id, item.id, price, enabled]);
    } else {
      sheet.getRange(rowIndex + 1, 3).setValue(price);   // C 欄：價格
      sheet.getRange(rowIndex + 1, 4).setValue(enabled); // D 欄：上架
    }
  });
}
