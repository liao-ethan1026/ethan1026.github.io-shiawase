export default function QtyControl({ qty, onMinus, onPlus }) {
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
