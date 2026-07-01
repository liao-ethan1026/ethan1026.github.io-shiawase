import SafeImage from "./SafeImage";
import QtyControl from "./QtyControl";

export default function MenuItem(props) {
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
