"""ShelfWatch ONNX inference port, owned by ShelfMind. See models/README.md."""
import ast
import base64
from io import BytesIO

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps


def jpeg_base64(image):
    height, width = image.shape[:2]
    if max(height, width) > 1600:
        image = cv2.resize(image, (round(width * 1600 / max(height, width)), round(height * 1600 / max(height, width))))
    ok, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        raise RuntimeError("Could not encode the analyzed image")
    return base64.b64encode(encoded).decode("ascii")


class DetectorService:
    def __init__(self, model_path):
        self.model = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        self.input_name = self.model.get_inputs()[0].name
        shape = self.model.get_inputs()[0].shape
        self.input_size = int(shape[-1]) if isinstance(shape[-1], int) else 640
        metadata = self.model.get_modelmeta().custom_metadata_map or {}
        names = ast.literal_eval(metadata.get("names", "{0: 'product'}"))
        self.class_names = dict(enumerate(names)) if isinstance(names, list) else names

    def detect(self, image_bytes):
        with Image.open(BytesIO(image_bytes)) as opened:
            rgb = ImageOps.exif_transpose(opened).convert("RGB")
            image = cv2.cvtColor(np.asarray(rgb), cv2.COLOR_RGB2BGR)
        height, width = image.shape[:2]
        scale = min(self.input_size / height, self.input_size / width)
        resized = cv2.resize(image, (round(width * scale), round(height * scale)))
        pad_w = (self.input_size - resized.shape[1]) / 2
        pad_h = (self.input_size - resized.shape[0]) / 2
        padded = cv2.copyMakeBorder(resized, round(pad_h - 0.1), round(pad_h + 0.1),
                                    round(pad_w - 0.1), round(pad_w + 0.1), cv2.BORDER_CONSTANT, value=(114, 114, 114))
        tensor = np.ascontiguousarray(padded[:, :, ::-1].transpose(2, 0, 1)[None], dtype=np.float32) / 255
        prediction = self.model.run(None, {self.input_name: tensor})[0][0]
        if prediction.shape[0] < prediction.shape[1]:
            prediction = prediction.T
        classes = prediction[:, 4:].argmax(axis=1)
        scores = prediction[np.arange(len(prediction)), 4 + classes]
        valid = scores >= 0.25
        boxes, scores, classes = prediction[valid, :4].copy(), scores[valid], classes[valid]
        detections = []
        if len(boxes):
            boxes[:, :2] -= boxes[:, 2:] / 2
            boxes[:, 0] = (boxes[:, 0] - pad_w) / scale
            boxes[:, 1] = (boxes[:, 1] - pad_h) / scale
            boxes[:, 2:] /= scale
            keep = cv2.dnn.NMSBoxesBatched(boxes.tolist(), scores.tolist(), classes.tolist(), 0.25, 0.45)
            for index in np.asarray(keep).flatten():
                x, y, w, h = boxes[index]
                bbox = [float(np.clip(x, 0, width)), float(np.clip(y, 0, height)),
                        float(np.clip(x + w, 0, width)), float(np.clip(y + h, 0, height))]
                if bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
                    continue
                detections.append({"bbox": bbox, "confidence": float(scores[index]),
                                   "class_id": int(classes[index]), "name": self.class_names.get(int(classes[index]), "product")})
        detections.sort(key=lambda item: item["confidence"], reverse=True)
        annotated = image.copy()
        for index, item in enumerate(detections):
            item["detection_id"] = f"D{index + 1:03d}"
            x1, y1, x2, y2 = map(round, item["bbox"])
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (63, 197, 255), 2)
            cv2.putText(annotated, f'{item["detection_id"]} {item["confidence"]:.2f}',
                        (x1, max(12, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (63, 197, 255), 1, cv2.LINE_AA)
        return {"detections": detections, "orig_img": image, "annotated_frame": annotated}


def measure_image(image, detections, blur_threshold):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape
    normalized = cv2.resize(gray, (round(width * 640 / max(height, width)), round(height * 640 / max(height, width)))) if max(height, width) > 640 else gray
    sharpness = float(cv2.Laplacian(normalized, cv2.CV_64F).var())
    brightness = float(gray.mean())
    mask = np.zeros((height, width), dtype=np.uint8)
    for detection in detections:
        x1, y1, x2, y2 = map(round, detection["bbox"])
        mask[max(0, y1):min(height, y2), max(0, x1):min(width, x2)] = 1
    confidence = float(np.mean([item["confidence"] for item in detections])) if detections else 0.0
    reasons = []
    if sharpness < blur_threshold:
        reasons.append("Possible blur")
    if min(height, width) < 240:
        reasons.append("Low image resolution")
    if brightness < 35 or brightness > 225:
        reasons.append("Poor exposure")
    if not detections:
        reasons.append("No items detected")
    elif confidence < 0.6 or any(item["confidence"] < 0.45 for item in detections):
        reasons.append("Uncertain detections")
    return {"sharpness": round(sharpness, 2), "blur_threshold": blur_threshold,
            "brightness": round(brightness, 2), "width": width, "height": height,
            "image_coverage_percent": round(float(mask.mean()) * 100, 2),
            "status": "REVIEW_REQUIRED" if reasons else "CLEAR", "reasons": reasons,
            "method": "Laplacian variance and exposure checks; heuristic, not calibrated accuracy"}
