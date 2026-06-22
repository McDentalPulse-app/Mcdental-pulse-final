import React from "react";

const getInitials = (name) =>
  name ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "";

const Avatar = ({ name, size = 36, color = "#006D5B" }) => (
  <div
    className="mc-avatar"
    style={{
      width: size,
      height: size,
      background: color,
      fontSize: size * 0.35,
    }}
  >
    {getInitials(name)}
  </div>
);

export default Avatar;
