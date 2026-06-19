import React, { useState } from "react";
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

const InicioEmpleado = ({ user, encuestas, mensajes, setActive }) => {
  const mis = encuestas.filter(e => e.empleadoId === user.id);
  const yaContesto = mis.some(e => e.semana === semanaActual);
  const ultimo = mis.sort((a,b)=>b.semana.localeCompare(a.semana))[0];
  const noLeidos = mensajes.filter(m => m.para === user.id && !m.leido).length;
  const ps = calcPulseScore(user.id, encuestas);
  return (
    <div>
      <div style={{ marginBottom:24 }}><h2 style={{ margin:0,fontSize:22,fontWeight:800,color:"#004D40" }}>Hola, {user.name.split(" ")[0]} 👋</h2><p style={{ margin:"4px 0 0",color:"#6b7280",fontSize:13 }}>{user.sucursal} · {user.puesto}</p></div>
      <div style={{ display:"flex",gap:16,flexWrap:"wrap",marginBottom:24 }}>
        <Card style={{ flex:1,minWidth:200,background:yaContesto?"#f0fdf4":"#fff7ed",border:`1.5px solid ${yaContesto?"#bbf7d0":"#fed7aa"}` }}>
          <div style={{ fontSize:24,marginBottom:8 }}>{yaContesto?"✅":"📝"}</div>
          <div style={{ fontWeight:700,fontSize:15,color:yaContesto?"#166534":"#c2410c" }}>{yaContesto?"Encuesta completada":"Encuesta pendiente"}</div>
          <div style={{ fontSize:12,color:"#6b7280",marginTop:4 }}>Semana {semanaActual}</div>
          {!yaContesto&&<button onClick={()=>setActive("encuesta")} style={{ marginTop:12,padding:"8px 16px",background:"#ea580c",color:"#fff",border:"none",borderRadius:8,fontWeight:600,fontSize:12,cursor:"pointer" }}>Contestar ahora</button>}
        </Card>
        {ultimo&&<Card style={{ flex:1,minWidth:200 }}><div style={{ fontSize:24,marginBottom:8 }}>📊</div><div style={{ fontWeight:700,fontSize:15,color:"#004D40" }}>Mi bienestar</div><div style={{ margin:"8px 0" }}><PulseScoreBadge score={ps.score} nivel={ps.nivel} color={ps.color} tendencia={ps.tendencia} size="md"/></div><Badge tipo={ultimo.semaforo}/></Card>}
        <Card style={{ flex:1,minWidth:200,cursor:"pointer" }} onClick={()=>setActive("mensajes")}>
          <div style={{ fontSize:24,marginBottom:8 }}>💬</div>
          <div style={{ fontWeight:700,fontSize:15,color:"#004D40" }}>Mensajes</div>
          {noLeidos>0?<div style={{ fontSize:13,color:"#ef4444",marginTop:4,fontWeight:600 }}>{noLeidos} mensaje(s) sin leer</div>:<div style={{ fontSize:13,color:"#9ca3af",marginTop:4 }}>Sin mensajes nuevos</div>}
          <button onClick={()=>setActive("mensajes")} style={{ marginTop:12,padding:"8px 16px",background:"#006D5B",color:"#fff",border:"none",borderRadius:8,fontWeight:600,fontSize:12,cursor:"pointer" }}>Hablar con psicóloga</button>
        </Card>
      </div>
      <Card><div style={{ fontWeight:700,fontSize:14,color:"#004D40",marginBottom:12 }}>📅 Mi historial reciente</div>{mis.length===0?<div style={{ color:"#9ca3af",fontSize:13 }}>Aún no tienes encuestas.</div>:mis.sort((a,b)=>b.semana.localeCompare(a.semana)).slice(0,5).map(e=>(<div key={e.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #f3f4f6",fontSize:13 }}><div style={{ color:"#374151" }}>📋 {e.semana}</div><Badge tipo={Number.isFinite(Number(e.score)) ? e.semaforo : "amarillo"}/><div style={{ fontWeight:700,color:"#006D5B" }}>{Number.isFinite(Number(e.score)) ? Number(e.score) : 50} pts</div></div>))}</Card>
    </div>
  );
};


export default InicioEmpleado;
