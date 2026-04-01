export type CaptureScreenshotFileOptions = {
  fileNamePrefix?: string;
};

function buildScreenshotFileName(prefix: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${timestamp}.png`;
}

export async function captureScreenshotFile(
  options: CaptureScreenshotFileOptions = {},
): Promise<File> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("SCREEN_CAPTURE_UNSUPPORTED");
  }

  const fileNamePrefix = options.fileNamePrefix?.trim() || "screenshot";
  let stream: MediaStream | null = null;

  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    const track = stream.getVideoTracks()[0];
    if (!track) {
      throw new Error("SCREEN_CAPTURE_FAILED");
    }

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((resolve) => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) resolve(undefined);
      else video.onloadeddata = () => resolve(undefined);
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("SCREEN_CAPTURE_FAILED");
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      throw new Error("SCREEN_CAPTURE_FAILED");
    }

    return new File([blob], buildScreenshotFileName(fileNamePrefix), { type: "image/png" });
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
}
