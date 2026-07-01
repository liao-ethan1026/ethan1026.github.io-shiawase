/**
 * 幸福蔬食 - Google Sheets API 後端
 * 給 GitHub Pages 前端 fetch() 使用
 *
 * 這版不負責顯示網頁。
 * 只負責：
 * 1. 接收 GitHub Pages 傳來的訂單資料
 * 2. 後端再次驗證
 * 3. 後端重新計算金額
 * 4. 寫入 Google Sheets
 *
 * ⚠️ 此檔案僅為版本備份紀錄，實際執行的是 Google Apps Script 上的版本。
 *    修改後請到 Apps Script 貼上並「管理部署作業 → 編輯 → 新版本」重新部署（網址不變）。
 */

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Rde3eDe6evLc4DvxNNzOWNjDKVdRuR_6oND7xgs_k0Y/edit';
const SHEET_NAME = '訂單';

const PRICES = {
  baoWith: 60,
  baoWithout: 60,
  soup: 60,
  soyMilk: 30,
  platter: 600
};

function doGet(e) {
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
        message: '沒有收到訂單資料'
      });
    }

    const orderData = JSON.parse(e.postData.contents);

    const items = normalizeItems(orderData.items || {});
    const form = normalizeForm(orderData.form || {});

    // 帶入訂餐地點（淡水福容飯店 / 其他），套用對應門檻
    const validation = validateOrder(items, form, orderData.orderType);

    if (!validation.success) {
      return jsonOutput(validation);
    }

    const totalAmount = calculateTotalAmount(items);
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

function calculateTotalAmount(items) {
  return (
    items.baoWith * PRICES.baoWith +
    items.baoWithout * PRICES.baoWithout +
    items.soup * PRICES.soup +
    items.soyMilk * PRICES.soyMilk +
    items.platter * PRICES.platter
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
