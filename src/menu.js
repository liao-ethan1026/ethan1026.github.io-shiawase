// 菜單集中設定區：未來修改價格或新增、刪除品項，只要修改這個 MENU 陣列即可
export const MENU = [
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
export const MENU_ITEMS = {};
export const INITIAL_CART = {};

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

export const TAIWAN_ZONES = {
  "台北市": ["中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"],
  "新北市": ["板橋區", "三重區", "中和區", "永和區", "新莊區", "新店區", "土城區", "蘆洲區", "樹林區", "汐止區", "鶯歌區", "三峽區", "淡水區", "瑞芳區", "五股區", "泰山區", "林口區", "深坑區", "石碇區", "坪林區", "三芝區", "石門區", "八里區", "平溪區", "雙溪區", "貢寮區", "金山區", "萬里區", "烏來區"]
};
