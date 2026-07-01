export default function CartRow({ name, qty, amount }) {
  return (
    <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
      <span>{name} x {qty}</span>
      <span className="font-medium">${amount}</span>
    </div>
  );
}
