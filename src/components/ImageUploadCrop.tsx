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

  canvas.width = outputSize;
  canvas.height = outputSize;

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

  return canvas.toDataURL("image/webp", 0.9);
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

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

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
      <div className="wireframe-box">
        <p>Select an image for your profile picture.</p>
        <div className="wireframe-row">
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Choose Image
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          style={{ display: "none" }}
        />
      </div>
    );
  }

  return (
    <div className="wireframe-col">
      <div style={{ position: "relative", width: "100%", height: "240px", border: "1px solid #777" }}>
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

      <div>
        <label>Zoom</label>
        <input
          type="range"
          value={zoom}
          min={1}
          max={3}
          step={0.1}
          aria-labelledby="Zoom"
          onChange={(e) => setZoom(Number(e.target.value))}
        />
      </div>

      <div className="wireframe-row">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={busy}>
          {busy ? "Saving..." : "Save Picture"}
        </button>
      </div>
    </div>
  );
}
