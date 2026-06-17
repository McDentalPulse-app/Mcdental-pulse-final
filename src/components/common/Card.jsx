import React from "react";
import { UI } from "../../config/theme";

const Card = ({ children, style = {} }) => (
  <div
    style={{
      background: "linear-gradient(180deg, #ffffff 0%, #fbfefe 100%)",
      borderRadius: UI.radio,
      padding: "24px 26px",
      border: "1px solid rgba(0, 109, 91, 0.08)",
      boxShadow: UI.sombraSuave,
      transition: "box-shadow .2s ease, transform .2s ease",
      ...style
    }}
  >
    {children}
  </div>
);

export default Card;