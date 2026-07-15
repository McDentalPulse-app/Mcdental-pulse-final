/**
 * Compresión de imágenes en el navegador, antes de subirlas.
 *
 * Vivía como función privada dentro de avatarService.js. Se saca aquí porque el
 * checador necesita exactamente lo mismo para las selfies, y duplicarla sería la peor
 * de las dos opciones: dos copias que se van separando con cada arreglo.
 */

const CALIDAD_JPEG = 0.82;

/**
 * Redimensiona y comprime a JPEG. Devuelve un Blob.
 *
 * Acepta un File (input de archivo) o un Blob/canvas ya generado (la cámara). El
 * bucket tiene su propio tope de tamaño server-side, pero llegar hasta él con una foto
 * de 8 MB desde el móvil de alguien en la calle es tirar sus datos y su paciencia: se
 * comprime antes de salir del teléfono.
 */
export const comprimirImagen = (archivo, maxDimension = 400, calidad = CALIDAD_JPEG) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Math.min(1, ...): nunca AMPLÍA. Estirar una foto pequeña solo la haría pesar
      // más sin añadir un solo píxel de información.
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen."))),
        "image/jpeg",
        calidad
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("El archivo seleccionado no es una imagen válida."));
    };

    img.src = url;
  });

/** Convierte un <canvas> a Blob JPEG. Lo usa la cámara del checador. */
export const canvasABlob = (canvas, calidad = CALIDAD_JPEG) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo capturar la foto."))),
      "image/jpeg",
      calidad
    );
  });
