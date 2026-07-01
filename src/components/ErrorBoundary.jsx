import { Component } from "react";

// 錯誤邊界：一旦 App 執行中發生例外，改顯示「發生錯誤，請重新整理」而不是整頁全白
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("畫面發生錯誤", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mb-4">
            !
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">發生錯誤，請重新整理</h1>
          <p className="text-sm text-gray-500 mb-6">
            系統暫時無法顯示，請點下方按鈕重新整理。
            <br />
            若持續發生，請聯絡店家{" "}
            <a href="tel:0938093816" className="text-orange-600 font-bold">0938093816</a>
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full max-w-xs bg-orange-600 active:bg-orange-700 text-white font-bold py-4 rounded-xl shadow-md"
          >
            重新整理
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
