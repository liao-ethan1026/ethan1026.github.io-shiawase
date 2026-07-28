import SafeImage from "./SafeImage";
import QtyControl from "./QtyControl";

export default function MenuItemWithTwoOptions(props) {
  const showA = props.enabledA !== false;
  const showB = props.enabledB !== false;

  return (
    <div className="bg-white rounded-xl shadow-sm border p-3 flex gap-4">
      <SafeImage src={props.image} alt={props.title} className="w-24 h-24 rounded-lg food-img flex-shrink-0" />

      <div className="flex-1 flex flex-col justify-center">
        <h2 className="text-lg font-bold text-gray-800 mb-2">{props.title}</h2>

        {showA && (
          <div className={`flex justify-between items-center mb-2 ${showB ? "" : ""}`}>
            <div className="text-sm text-gray-600">
              {props.optionA} <span className="text-orange-600 font-bold">${props.priceA}</span>
            </div>

            <QtyControl qty={props.qtyA} onMinus={props.onMinusA} onPlus={props.onPlusA} />
          </div>
        )}

        {showB && (
          <div className={`flex justify-between items-center ${showA ? "border-t border-gray-100 pt-2" : ""}`}>
            <div className="text-sm text-gray-600">
              {props.optionB} <span className="text-orange-600 font-bold">${props.priceB}</span>
            </div>

            <QtyControl qty={props.qtyB} onMinus={props.onMinusB} onPlus={props.onPlusB} />
          </div>
        )}
      </div>
    </div>
  );
}
