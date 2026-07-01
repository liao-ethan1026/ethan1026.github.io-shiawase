export default function ReceiptRow({ name, qty, price }) {
  return (
    <tr>
      <td style={{ padding: "6px 0" }}>{name}</td>
      <td align="center">{qty}</td>
      <td style={{ textAlign: "right" }}>${qty * price}</td>
    </tr>
  );
}
