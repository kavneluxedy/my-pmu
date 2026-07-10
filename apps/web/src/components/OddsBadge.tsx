export default function OddsBadge({
   odds,
   color,
   favorite,
   onDark,
}: Readonly<{
   odds: number;
   color: string;
   favorite?: boolean;
   onDark?: boolean;
}>) {
   const textColor = onDark ? "#0b1a10" : color;
   return (
      <span
         style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 12,
            fontWeight: favorite ? 700 : 500,
            color: textColor,
            border: `1px solid ${onDark ? "#0b1a10" : color}`,
            borderRadius: 999,
            padding: "1px 6px",
         }}
      >
         {favorite && <span aria-hidden>★</span>}
         {odds.toFixed(1)}
      </span>
   );
}
