import { supabase } from "./supabase";

/**
 * Compresses an image File to a webp (or jpeg fallback) Blob.
 * - Resizes so longest side is at most 1000 px (never upscales).
 * - Honors EXIF orientation where supported.
 * - Progressively compresses if needed to ensure size is under 400 KB (or max 900 KB).
 */
export async function compressImage(file: File): Promise<Blob> {
  // Reject non-image files
  if (!file || !file.type || !file.type.startsWith("image/")) {
    throw new Error("Please choose a photo (JPG, PNG or WebP).");
  }

  type SourceInfo = {
    width: number;
    height: number;
    draw: (ctx: CanvasRenderingContext2D, dw: number, dh: number) => void;
    cleanup: () => void;
  };

  let source: SourceInfo;

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);
      source = {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, dw, dh) => ctx.drawImage(bitmap, 0, 0, dw, dh),
        cleanup: () => bitmap.close(),
      };
    } catch {
      try {
        const bitmap = await createImageBitmap(file);
        source = {
          width: bitmap.width,
          height: bitmap.height,
          draw: (ctx, dw, dh) => ctx.drawImage(bitmap, 0, 0, dw, dh),
          cleanup: () => bitmap.close(),
        };
      } catch {
        source = await loadImageElement(file);
      }
    }
  } else {
    source = await loadImageElement(file);
  }

  try {
    const origW = source.width;
    const origH = source.height;

    if (!origW || !origH) {
      throw new Error("Please choose a photo (JPG, PNG or WebP).");
    }

    const renderToCanvas = (maxSide: number): HTMLCanvasElement => {
      const longest = Math.max(origW, origH);
      let targetW = origW;
      let targetH = origH;
      if (longest > maxSide) {
        const scale = maxSide / longest;
        targetW = Math.round(origW * scale);
        targetH = Math.round(origH * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas context.");
      source.draw(ctx, targetW, targetH);
      return canvas;
    };

    const exportBlob = async (canvas: HTMLCanvasElement, quality: number): Promise<Blob> => {
      let blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/webp", quality);
      });
      if (!blob || blob.type !== "image/webp") {
        blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
        });
      }
      if (!blob) {
        throw new Error("Could not compress photo.");
      }
      return blob;
    };

    // Pass 1: max side 1000 px, quality 0.82
    let canvas = renderToCanvas(1000);
    let blob = await exportBlob(canvas, 0.82);

    // If result is still larger than 400 KB, retry once at quality 0.65
    if (blob.size > 400 * 1024) {
      blob = await exportBlob(canvas, 0.65);
    }

    // Then once more at 0.5 with max side 800 px
    if (blob.size > 400 * 1024) {
      canvas = renderToCanvas(800);
      blob = await exportBlob(canvas, 0.5);
    }

    // If still larger than 900 KB, throw
    if (blob.size > 900 * 1024) {
      throw new Error("This photo is too large. Please choose a smaller one.");
    }

    return blob;
  } finally {
    source.cleanup();
  }
}

async function loadImageElement(file: File) {
  if (typeof window === "undefined") {
    throw new Error("Image compression is only supported in browser environment.");
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Please choose a photo (JPG, PNG or WebP)."));
      img.src = url;
    });
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx: CanvasRenderingContext2D, dw: number, dh: number) => {
        ctx.drawImage(img, 0, 0, dw, dh);
      },
      cleanup: () => {
        URL.revokeObjectURL(url);
      },
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Uploads a menu item photo to Supabase storage bucket `menu-images`.
 * File path: `${businessId}/${randomUUID()}.${ext}`
 */
export async function uploadMenuImage(file: File, businessId: string): Promise<string> {
  const blob = await compressImage(file);
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${businessId}/${randomId}.${ext}`;

  const { error } = await supabase.storage.from("menu-images").upload(path, blob, {
    contentType: blob.type,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    console.error("Supabase storage upload error:", error);
    throw new Error("Could not upload the photo. Check your internet and try again.");
  }

  const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
  return data.publicUrl;
}
