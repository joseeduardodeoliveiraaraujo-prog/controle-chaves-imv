import keyImage from "../assets/etiqueta-chave.png";

export default function KeyIcon({ status = "available", className = "" }) {
  const classes = ["key-icon", status, className].filter(Boolean).join(" ");

  return (
    <span
      className={classes}
      style={{
        WebkitMaskImage: `url(${keyImage})`,
        maskImage: `url(${keyImage})`,
      }}
      aria-hidden="true"
    />
  );
}