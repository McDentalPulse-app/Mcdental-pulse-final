#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Construye el anteproyecto: fuente-anteproyecto.html -> .docx -> .pdf

Hace tres cosas que LibreOffice no hace solo al importar HTML:
  1. Inyecta un pie de página con "Página N de M" (el importador de HTML no
     tiene forma de expresar encabezados ni pies).
  2. Marca la portada como primera página distinta, para que NO lleve número.
  3. Rellena los números de página del índice midiendo el PDF ya paginado
     (dos pasadas: se construye, se mide, se vuelve a construir).

Uso:  python3 construir.py
"""

import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

DIR = Path(__file__).resolve().parent
HTML = DIR / "fuente-anteproyecto.html"
BASE = "Anteproyecto-Ecosistema-McDental-Pulse"
DOCX = DIR / f"{BASE}.docx"
PDF = DIR / f"{BASE}.pdf"
TRABAJO = DIR / ".build"

SOFFICE = "soffice"

# Secciones del índice: (texto tal cual aparece en el PDF en mayúsculas, clave)
SECCIONES = [
    ("1. DATOS GENERALES", "S1"),
    ("2. NOMBRE DEL PROYECTO", "S2"),
    ("3. OBJETIVOS", "S3"),
    ("4. JUSTIFICACIÓN", "S4"),
    ("5. CARACTERIZACIÓN DEL ÁREA", "S5"),
    ("6. PROBLEMAS A RESOLVER", "S6"),
    ("7. ALCANCES Y LIMITACIONES", "S7"),
    ("8. FUNDAMENTO TEÓRICO", "S8"),
    ("9. PROCEDIMIENTO Y DESCRIPCIÓN", "S9"),
    ("10. CRONOGRAMA DE ACTIVIDADES", "S10"),
    ("11. RECURSOS REQUERIDOS", "S11"),
    ("12. RESULTADOS ESPERADOS", "S12"),
    ("13. REFERENCIAS BIBLIOGRÁFICAS", "S13"),
    ("14. FIRMAS DE CONFORMIDAD", "S14"),
]

FOOTER_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:jc w:val="center"/>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/></w:rPr>
    </w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/></w:rPr>
      <w:t xml:space="preserve">Página </w:t></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/></w:rPr>
      <w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/></w:rPr>
      <w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/></w:rPr>
      <w:fldChar w:fldCharType="end"/></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/></w:rPr>
      <w:t xml:space="preserve"> de </w:t></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/></w:rPr>
      <w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/></w:rPr>
      <w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/></w:rPr>
      <w:fldChar w:fldCharType="end"/></w:r>
  </w:p>
</w:ftr>
"""

FOOTER_VACIO_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p>
</w:ftr>
"""


def sh(*args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"Falló: {' '.join(args)}\n{r.stderr}")
    return r.stdout


def html_a_docx(html: Path, destino: Path):
    """Importa como documento de Writer (no Writer/Web) para conservar márgenes."""
    TRABAJO.mkdir(exist_ok=True)
    sh(SOFFICE, "--headless", "--infilter=HTML (StarWriter)",
       "--convert-to", "docx:MS Word 2007 XML", str(html), "--outdir", str(TRABAJO))
    generado = TRABAJO / (html.stem + ".docx")
    shutil.move(str(generado), str(destino))


def inyectar_pie(docx: Path):
    """Añade pie con 'Página N de M' y deja la portada sin número."""
    tmp = docx.with_suffix(".tmp.docx")
    with zipfile.ZipFile(docx) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        nombres = zin.namelist()
        for nombre in nombres:
            datos = zin.read(nombre)

            if nombre == "[Content_Types].xml":
                x = datos.decode("utf-8")
                if "footer1.xml" not in x:
                    x = x.replace("</Types>",
                        '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
                        '<Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
                        "</Types>")
                datos = x.encode("utf-8")

            elif nombre == "word/_rels/document.xml.rels":
                x = datos.decode("utf-8")
                usados = [int(n) for n in re.findall(r'Id="rId(\d+)"', x)]
                base = max(usados) if usados else 0
                global RID_PIE, RID_PIE_PORTADA
                RID_PIE, RID_PIE_PORTADA = f"rId{base+1}", f"rId{base+2}"
                x = x.replace("</Relationships>",
                    f'<Relationship Id="{RID_PIE}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
                    f'<Relationship Id="{RID_PIE_PORTADA}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>'
                    "</Relationships>")
                datos = x.encode("utf-8")

            zout.writestr(nombre, datos)

        # document.xml se reescribe al final: necesita los rId ya calculados
        doc = zin.read("word/document.xml").decode("utf-8")
        doc = re.sub(
            r"(<w:sectPr[^>]*>)",
            r'\1<w:footerReference w:type="default" r:id="' + RID_PIE + '"/>'
            r'<w:footerReference w:type="first" r:id="' + RID_PIE_PORTADA + '"/>',
            doc, count=1)
        doc = doc.replace("</w:sectPr>", "<w:titlePg/></w:sectPr>", 1)
        zout.writestr("word/document.xml", doc.encode("utf-8"))
        zout.writestr("word/footer1.xml", FOOTER_XML.encode("utf-8"))
        zout.writestr("word/footer2.xml", FOOTER_VACIO_XML.encode("utf-8"))

    # el zip original ya tenía document.xml; se elimina el duplicado reconstruyendo
    limpio = docx.with_suffix(".limpio.docx")
    with zipfile.ZipFile(tmp) as zin, zipfile.ZipFile(limpio, "w", zipfile.ZIP_DEFLATED) as zout:
        vistos = set()
        for info in reversed(zin.infolist()):   # se conserva la ÚLTIMA versión escrita
            if info.filename in vistos:
                continue
            vistos.add(info.filename)
            zout.writestr(info.filename, zin.read(info.filename))
    tmp.unlink()
    limpio.replace(docx)


def docx_a_pdf(docx: Path, destino: Path):
    sh(SOFFICE, "--headless", "--convert-to", "pdf", str(docx), "--outdir", str(TRABAJO))
    shutil.move(str(TRABAJO / (docx.stem + ".pdf")), str(destino))


def paginas_de_secciones(pdf: Path) -> dict:
    total = int(re.search(r"Pages:\s+(\d+)", sh("pdfinfo", str(pdf))).group(1))
    encontrado = {}
    for p in range(1, total + 1):
        texto = sh("pdftotext", "-f", str(p), "-l", str(p), str(pdf), "-")
        for etiqueta, clave in SECCIONES:
            if clave not in encontrado and etiqueta in texto:
                encontrado[clave] = p
    return encontrado


def poner_logos(texto: str) -> str:
    """Sustituye los marcadores de logo por las imágenes, si están en logos/.

    La ruta va absoluta a propósito: el HTML intermedio se genera en .build/ y
    una ruta relativa se resolvería desde ahí, dejando el marco vacío.
    """
    logos = DIR / "logos"
    # Alturas distintas a propósito: el del TecNM es apaisado (2:1) y el escudo
    # del ITA es vertical; con la misma altura uno aplasta visualmente al otro.
    #
    # Se redimensionan A DISCO en vez de fijar height="" en el <img>: el
    # importador de HTML de Writer ignora ese atributo e inserta la imagen a su
    # tamaño natural, que en el escudo del ITA (420x476) ocupa media portada.
    for archivo, marcador, alto in (("tecnm", "[LOGO TecNM]", 95),
                                    ("ita", "[LOGO ITA]", 125)):
        img = next((logos / f"{archivo}{ext}" for ext in (".png", ".jpg", ".jpeg")
                    if (logos / f"{archivo}{ext}").exists()), None)
        if img is None:
            print(f"  aviso: falta logos/{archivo}.png — se deja el marcador")
            continue
        escalado = TRABAJO / f"logo_{archivo}.png"
        sh("convert", str(img), "-trim", "+repage", "-resize", f"x{alto}", str(escalado))
        texto = texto.replace(f'<span class="ph">{marcador}</span>',
                              f'<img src="file://{escalado}">')
    return texto


def main():
    TRABAJO.mkdir(exist_ok=True)
    fuente = poner_logos(HTML.read_text(encoding="utf-8"))

    # --- 1.ª pasada: construir con los marcadores puestos, para medir ---
    provisional = TRABAJO / "medicion.html"
    provisional.write_text(re.sub(r"##S\d+##", "&nbsp;", fuente), encoding="utf-8")
    html_a_docx(provisional, TRABAJO / "medicion.docx")
    inyectar_pie(TRABAJO / "medicion.docx")
    docx_a_pdf(TRABAJO / "medicion.docx", TRABAJO / "medicion.pdf")
    paginas = paginas_de_secciones(TRABAJO / "medicion.pdf")

    faltan = [c for _, c in SECCIONES if c not in paginas]
    if faltan:
        print(f"  aviso: no se ubicaron en el PDF: {', '.join(faltan)}")

    # --- 2.ª pasada: con los números reales del índice ---
    final = TRABAJO / "final.html"
    texto = fuente
    for _, clave in SECCIONES:
        texto = texto.replace(f"##{clave}##", str(paginas.get(clave, "")))
    final.write_text(texto, encoding="utf-8")

    html_a_docx(final, DOCX)
    inyectar_pie(DOCX)
    docx_a_pdf(DOCX, PDF)

    total = re.search(r"Pages:\s+(\d+)", sh("pdfinfo", str(PDF))).group(1)
    pendientes = sorted(set(re.findall(r'<span class="ph">\[(.*?)\]</span>', fuente)))
    print(f"\nListo: {DOCX.name} y {PDF.name} ({total} páginas)")
    print("Índice:", ", ".join(f"{c}=p{paginas[c]}" for _, c in SECCIONES if c in paginas))
    if pendientes:
        print(f"\nDatos por completar ({len(pendientes)}), resaltados en amarillo:")
        for x in pendientes:
            print("  -", x)


if __name__ == "__main__":
    main()
