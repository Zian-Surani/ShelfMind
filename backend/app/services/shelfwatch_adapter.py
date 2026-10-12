from __future__ import annotations

import hashlib
import time
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from threading import Lock

from app.core.config import settings
from app.services.vision_detector import DetectorService, jpeg_base64, measure_image


class ShelfWatchAdapter:
    """Compatibility entry point for ShelfMind's bundled image detector."""

    def __init__(self, model_path: Path | None = None):
        self.model_path = model_path or settings.vision_model_path
        self._detector = None
        self._lock = Lock()

    def summarize(self):
        return {"available": self.model_path.is_file(), "model_available": self.model_path.is_file(),
                "engine": "ShelfMind ONNX", "external_project_required": False}

    def analyze_image_bytes(self, image_bytes: bytes, filename: str = "uploaded-image"):
        started = time.perf_counter()
        with self._lock:
            if not self.model_path.is_file():
                raise RuntimeError("Bundled detector missing: place best.onnx in backend/models.")
            if self._detector is None:
                try:
                    self._detector = DetectorService(self.model_path)
                except Exception as exc:
                    raise RuntimeError("Could not initialize the bundled ONNX detector.") from exc
            result = self._detector.detect(image_bytes)
        image = result["orig_img"]
        height, width = image.shape[:2]
        detections = result["detections"]
        for item in detections:
            x1, y1, x2, y2 = item["bbox"]
            item["box"] = {"x": round(x1 / width * 100, 2), "y": round(y1 / height * 100, 2),
                           "w": round((x2 - x1) / width * 100, 2), "h": round((y2 - y1) / height * 100, 2), "color": "#EAB308"}
            item["bbox"] = [round(value, 2) for value in item["bbox"]]
            item["confidence"] = round(item["confidence"], 4)
        quality = measure_image(image, detections, settings.vision_blur_threshold)
        average = sum(item["confidence"] for item in detections) / len(detections) if detections else 0
        return {"source": "ShelfMind vision", "model_path": self.model_path.name,
                "filename": Path(filename).name, "image_sha256": hashlib.sha256(image_bytes).hexdigest(),
                "product_count": len(detections), "detections": detections,
                "average_confidence": round(average, 4), "quality": quality,
                "risk_level": "UNKNOWN", "needs_reinspection": quality["status"] != "CLEAR",
                "source_image_path": f"uploaded:{Path(filename).name}", "processing_time": round(time.perf_counter() - started, 4),
                "annotated_image": jpeg_base64(result["annotated_frame"]), "original_image": jpeg_base64(image),
                "observed_at": datetime.now(timezone.utc).isoformat()}


@lru_cache(maxsize=1)
def get_shelfwatch_adapter():
    return ShelfWatchAdapter()
