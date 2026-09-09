import { useState, useCallback, useRef } from "react";
import Cropper, { Area } from "react-easy-crop";
import imageCompression from "browser-image-compression";

// Utility function to get cropped image as Base64 string
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

async function getCroppedImg(imageSrc: string, pixelCrop: Area, outputSize = 512): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  // Set canvas size to the desired output size (512x512)
  canvas.width = outputSize;
  canvas.height = outputSize;

  // Draw the cropped image onto the canvas, scaling it to outputSize
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return canvas.toDataURL("image/webp", 0.9); // Returns webp format
}

export function ImageUploadCrop({
  onSave,
  onCancel,
  busy,
}: {
  onSave: (base64: string) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Pre-compress large images before cropping for performance
      try {
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1024,
          useWebWorker: true,
        });
        const imageDataUrl = await imageCompression.getDataUrlFromFile(compressedFile);
        setImageSrc(imageDataUrl);
      } catch (error) {
        console.error("Error compressing image:", error);
      }
    }
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, 512);
      await onSave(croppedImage);
    } catch (e) {
      console.error(e);
    }
  };

  if (!imageSrc) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-3xl bg-cream">
        <p className="mb-4 text-charcoal font-body text-center">
          Select an image for your profile picture.
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl bg-blue-parent px-6 py-2 font-bold text-white shadow-sm"
        >
          Choose Image
        </button>
        <button onClick={onCancel} className="mt-4 font-bold text-slate-parent hover:underline">
          Cancel
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-full h-64 sm:h-80 bg-black rounded-3xl overflow-hidden">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
        />
      </div>

      <div className="w-full px-4">
        <label className="text-xs font-bold text-charcoal mb-1 block">Zoom</label>
        <input
          type="range"
          value={zoom}
          min={1}
          max={3}
          step={0.1}
          aria-labelledby="Zoom"
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="flex space-x-3 w-full">
        <button
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-xl bg-slate-200 py-3 font-bold text-charcoal disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          className="flex-1 rounded-xl bg-blue-parent py-3 font-bold text-white disabled:opacity-50 shadow-soft"
        >
          {busy ? "Saving..." : "Save Picture"}
        </button>
      </div>
    </div>
  );
}
