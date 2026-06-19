import React, { useState, useEffect, useRef } from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import RiskBar from "../common/RiskBar";
import { semaforoColor, semaforoBg, semaforoLabel } from "../../config/theme";
import { USERS } from "../../data/initialData";
import { semanaActual } from "../../utils/constants";
import { calcularAntiguedad } from "../../utils/helpers";
import { calcPulseScore, getPulseStatus, calcRiesgos } from "../../utils/pulseScore";
import { db } from "../../firebase";
import { collection, addDoc, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";

const AIChatBubble = ({ mensaje, loading }) => (
  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#006D5B,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🤖</div>
    <div style={{ flex: 1, background: "linear-gradient(135deg,#f0fdf4,#e0f2fe)", border: "1px solid #bbf7d0", borderRadius: "0 12px 12px 12px", padding: "12px 16px", fontSize: 13, color: "#111827", lineHeight: 1.6 }}>
      {loading ? <span style={{ color: "#9ca3af" }}>Analizando datos... ✨</span> : mensaje}
    </div>
  </div>
);


export default AIChatBubble;
