# Bundled ShelfMind detector

`best.onnx` is bundled here, so inference does not import or contact ShelfWatch.
The ONNX preprocessing and detection decoding were ported from the user's local
ShelfWatch AI project. ShelfMind adds image quality measurements, numbered
detections, and reviewed product assignments. The model detects generic products,
not SKU identities. Detection IDs are local to each image.

Model source: the supplied ShelfWatch AI/backend/models/best.onnx (44,745,918 bytes).
No model redistribution license was present in that project when integrated.
Verify the model's training-data and redistribution rights before commercial distribution.

Keep this model when copying or packaging ShelfMind. A different compatible ONNX
model can be configured with SHELFMIND_VISION_MODEL_PATH. No absolute user path is
required by default. Image blur checks use OpenCV Laplacian variance with a
configurable, heuristic threshold, not a validated image-quality probability.
