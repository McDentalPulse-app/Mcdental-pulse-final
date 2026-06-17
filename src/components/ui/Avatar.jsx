import React from "react";

const getInitials = (name) => name ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "";

const Avatar = ({ name, size = 36, color = "#006D5B" }) => (
  <div style={{ 
    width: size, 
    height: size, 
    borderRadius: "50%", 
    background: color, 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    color: "#fff", 
    fontWeight: 700, 
    fontSize: size * 0.35, 
    flexShrink: 0 
  }}>
    {getInitials(name)}
  </div>
);

export default Avatar;