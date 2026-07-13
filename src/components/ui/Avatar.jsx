import React from "react";

const getInitials = (name) =>
  name ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "";

const Avatar = ({ name, size = 36, color = "var(--mc-verde)", photoUrl }) => (
  <div
    className="mc-avatar"
    style={{
      width: size,
      height: size,
      background: photoUrl ? undefined : color,
      fontSize: size * 0.35,
      padding: 0,
      overflow: "hidden",
    }}
  >
    {photoUrl
      ? <img src={photoUrl} alt={name || "Avatar"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      : getInitials(name)}
  </div>
);

export default Avatar;
