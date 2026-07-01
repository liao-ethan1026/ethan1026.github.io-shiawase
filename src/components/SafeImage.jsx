import { useState, useEffect, useRef } from "react";

export default function SafeImage({ src, alt, className }) {
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
