import React from "react";

// Inline markdown: **negrita**, *cursiva*, `código`.
const parseInlineMD = (text) => {
  const nodes = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m, key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) nodes.push(<strong key={key++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) nodes.push(<code key={key++} className="ai-md-code">{t.slice(1, -1)}</code>);
    else nodes.push(<em key={key++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

// Render markdown-lite por bloques: encabezados, listas (•/numéricas), párrafos, separadores.
const MarkdownLite = ({ text }) => {
  const blocks = [];
  let list = null;
  const flush = () => { if (list) { blocks.push(list); list = null; } };

  String(text || "").split("\n").forEach(raw => {
    const line = raw.trim();
    if (!line) { flush(); return; }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (/^[-*_]{3,}$/.test(line)) { flush(); blocks.push({ type: "hr" }); }
    else if (h) { flush(); blocks.push({ type: "h", level: h[1].length, text: h[2] }); }
    else if (ul) { if (!list || list.type !== "ul") { flush(); list = { type: "ul", items: [] }; } list.items.push(ul[1]); }
    else if (ol) { if (!list || list.type !== "ol") { flush(); list = { type: "ol", items: [] }; } list.items.push(ol[1]); }
    else { flush(); blocks.push({ type: "p", text: line }); }
  });
  flush();

  return (
    <div className="ai-md">
      {blocks.map((b, i) => {
        if (b.type === "hr") return <hr key={i} className="ai-md-hr" />;
        if (b.type === "h") return <p key={i} className={`ai-md-h ai-md-h${b.level}`}>{parseInlineMD(b.text)}</p>;
        if (b.type === "ul") return <ul key={i} className="ai-md-ul">{b.items.map((it, j) => <li key={j}>{parseInlineMD(it)}</li>)}</ul>;
        if (b.type === "ol") return <ol key={i} className="ai-md-ol">{b.items.map((it, j) => <li key={j}>{parseInlineMD(it)}</li>)}</ol>;
        return <p key={i} className="ai-md-p">{parseInlineMD(b.text)}</p>;
      })}
    </div>
  );
};

export default MarkdownLite;
