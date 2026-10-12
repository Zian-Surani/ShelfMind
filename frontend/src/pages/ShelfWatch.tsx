import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Play,
  Check,
  X,
  Pencil,
  RefreshCw,
  AlertTriangle,
  Settings2,
  Image as ImageIcon,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  Layers,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../store/appStore';
import { shelfmindApi } from '../lib/shelfmindApi';
import { Decision, ProductReviewHistory, ShelfAnalyzeResult } from '../types';
import { ProductHistoryChart } from '../components/charts/ProductHistoryChart';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const statusLabel = (value: string) =>
  ({
    AUTO_EXECUTED: 'Auto-approved',
    APPROVAL_REQUIRED: 'Needs Manager Approval',
    APPROVED: 'Approved by Manager',
    MODIFIED: 'Adjusted & Approved',
    REJECTED: 'Rejected',
    SUPERSEDED: 'Replaced by Newer Count',
  }[value] || value);

const getFilename = (image: ShelfAnalyzeResult) =>
  image.filename || image.source_image_path.replace(/^uploaded:/, '');

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The request failed.';

export const ShelfWatch: React.FC = () => {
  const { products, settings, setCurrentTab, refreshBackendState } = useApp();
  const [images, setImages] = useState<ShelfAnalyzeResult[]>([]);
  const [activeId, setActiveId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [loadingImages, setLoadingImages] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failures, setFailures] = useState<{ file: File; error: string }[]>([]);

  // Review Form State
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [verified, setVerified] = useState(false);

  // Evidence & Evaluation State
  const [history, setHistory] = useState<ProductReviewHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Action Adjustment State
  const [actionMode, setActionMode] = useState<'modify' | 'reject' | null>(null);
  const [actionQuantity, setActionQuantity] = useState('');
  const [reason, setReason] = useState('');

  const requestId = useRef(crypto.randomUUID());
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);

  const activeImage = images.find((image) => image.observation_id === activeId) || images[0];
  const assessment = decision?.imageReview?.assessment;

  useEffect(() => {
    mounted.current = true;
    shelfmindApi
      .shelfImages()
      .then((rows) => {
        if (mounted.current) {
          setImages(rows);
          if (rows.length > 0 && !activeId) {
            setActiveId(rows[0].observation_id);
            setSelectedIds([rows[0].observation_id]);
          }
        }
      })
      .catch((err) => {
        if (mounted.current) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (mounted.current) setLoadingImages(false);
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setHistory(null);
    setDecision(null);
    if (!productId) return;
    setHistoryLoading(true);
    shelfmindApi
      .productReviewHistory(productId)
      .then((result) => {
        if (active) {
          setHistory(result);
          setDecision(result.reviews[0] || null);
        }
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  const invalidate = () => {
    setVerified(false);
    setDecision(null);
    setActionMode(null);
    requestId.current = crypto.randomUUID();
  };

  const toggleImage = (id: string) => {
    if (busy || uploading) return;
    if (!selectedIds.includes(id) && selectedIds.length >= 12) {
      setError('A review can include at most 12 photos.');
      return;
    }
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
    setActiveId(id);
    invalidate();
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    if (files.length > 12) {
      setError('Choose at most 12 images per upload.');
      return;
    }
    setUploading(true);
    setFailures([]);
    setError('');
    invalidate();
    setProgress({ done: 0, total: files.length });

    const newObservationIds: string[] = [];

    for (const [index, file] of files.entries()) {
      if (!mounted.current) break;
      try {
        if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
          throw new Error('An image file of at most 10 MB is required.');
        }
        const result = await shelfmindApi.analyzeShelfImage(file);
        if (!mounted.current) break;
        setImages((prev) => [result, ...prev.filter((item) => item.observation_id !== result.observation_id)].slice(0, 24));
        newObservationIds.push(result.observation_id);
        setActiveId(result.observation_id);
      } catch (err) {
        if (mounted.current) setFailures((prev) => [...prev, { file, error: getErrorMessage(err) }]);
      } finally {
        if (mounted.current) setProgress({ done: index + 1, total: files.length });
      }
    }

    if (mounted.current) {
      if (newObservationIds.length > 0) {
        setSelectedIds(newObservationIds);
      }
      setUploading(false);
      void refreshBackendState();
    }
  };

  const handleEvaluate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!verified || !selectedIds.length || !productId || quantity === '') return;
    setBusy(true);
    setError('');
    try {
      const result = await shelfmindApi.reviewProduct(productId, selectedIds, Number(quantity), requestId.current);
      setDecision(result);
      setHistory(await shelfmindApi.productReviewHistory(productId));
      await refreshBackendState();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDecisionAction = async (kind: 'approve' | 'modify' | 'reject') => {
    if (!decision) return;
    setBusy(true);
    setError('');
    try {
      const result =
        kind === 'approve'
          ? await shelfmindApi.approveDecision(decision.id)
          : kind === 'modify'
          ? await shelfmindApi.modifyDecision(decision.id, Number(actionQuantity), reason)
          : await shelfmindApi.rejectDecision(decision.id, reason);
      setDecision(result);
      setActionMode(null);
      setReason('');
      setHistory(await shelfmindApi.productReviewHistory(productId));
      await refreshBackendState();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Quick helper to fill quantity from active image detections
  const handleUseDetectionCount = () => {
    if (activeImage) {
      setQuantity(String(activeImage.product_count));
      invalidate();
    }
  };

  const selectedImages = images.filter((img) => selectedIds.includes(img.observation_id));
  const hasBlurrySelected = selectedImages.some(
    (img) => img.quality?.status === 'REVIEW_REQUIRED' || (img.quality && img.quality.sharpness < img.quality.blur_threshold)
  );

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header Banner in Tactile Bento Style */}
      <div className="clay-card p-6 bg-gradient-to-r from-white via-white to-[#f5fbf2] flex flex-wrap items-center justify-between gap-4 border border-[#ccebc4]/70">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e7f5e1] text-[#204130] text-xs font-semibold mb-2">
            <Cpu size={14} className="text-[#32664b]" />
            <span>Embedded ONNX Vision Engine • Standalone Deployment</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Image Review & Policy Evaluation
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            Upload shelf photos, check image sharpness & blur, select item ID, verify stock count, and evaluate Bellman MDP policy.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading || busy}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#32664b] hover:bg-[#204130] text-white text-sm font-semibold shadow-clay-button hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50"
          >
            {uploading ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? `Processing ${progress.done} of ${progress.total}...` : 'Upload Photos'}
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*"
            aria-label="Upload shelf images"
            className="hidden"
            onChange={(event) => {
              void uploadFiles(Array.from(event.target.files || []));
              event.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div role="alert" className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {failures.map((failure, index) => (
        <div key={index} role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between gap-3">
          <span>
            {failure.file.name}: {failure.error}
          </span>
          <button
            disabled={uploading}
            onClick={() => void uploadFiles([failure.file])}
            className="inline-flex items-center gap-1 font-semibold underline text-rose-900"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      ))}

      {/* Main 2-Column Bento Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left Column: Image Gallery & Inspector (Span 7) */}
        <section className="lg:col-span-7 space-y-5" aria-label="Visual shelf analysis">
          {/* Thumbnails Carousel */}
          <div className="clay-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <ImageIcon size={16} className="text-[#32664b]" />
                <span>Uploaded Shelf Photos</span>
                <span className="text-xs font-normal text-gray-500">
                  ({images.length} available, {selectedIds.length} selected for review)
                </span>
              </h2>

              {activeImage && (
                <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBoundingBoxes}
                    onChange={(e) => setShowBoundingBoxes(e.target.checked)}
                    className="rounded text-[#32664b] focus:ring-[#32664b]"
                  />
                  Show Detection Boxes
                </label>
              )}
            </div>

            {images.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 pt-1">
                {images.map((image) => {
                  const isSelected = selectedIds.includes(image.observation_id);
                  const isActive = activeImage?.observation_id === image.observation_id;
                  const isBlurry =
                    image.quality?.status === 'REVIEW_REQUIRED' ||
                    (image.quality && image.quality.sharpness < image.quality.blur_threshold);

                  return (
                    <div
                      key={image.observation_id}
                      className={`w-36 shrink-0 rounded-2xl overflow-hidden border transition-all ${
                        isActive
                          ? 'border-[#32664b] ring-2 ring-[#32664b]/20 shadow-md'
                          : isSelected
                          ? 'border-[#3e7b5c]/70 bg-white'
                          : 'border-gray-200 bg-white opacity-85 hover:opacity-100'
                      }`}
                    >
                      <button
                        onClick={() => setActiveId(image.observation_id)}
                        className="block h-24 w-full bg-[#f5fbf2] relative overflow-hidden"
                      >
                        <img
                          src={`data:image/jpeg;base64,${image.original_image || image.annotated_image}`}
                          alt={getFilename(image)}
                          className="h-full w-full object-cover"
                        />
                        {/* Status Overlay Pill */}
                        <div className="absolute top-1.5 right-1.5">
                          {isBlurry ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/90 text-white flex items-center gap-1 shadow-sm">
                              ⚠️ Blur
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-600/90 text-white flex items-center gap-1 shadow-sm">
                              ✓ Clear
                            </span>
                          )}
                        </div>
                      </button>

                      <div className="p-2.5 space-y-1 text-left bg-white">
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={busy || uploading}
                            onChange={() => toggleImage(image.observation_id)}
                            className="rounded text-[#32664b] focus:ring-[#32664b]"
                          />
                          <span className="truncate text-[11px]" title={getFilename(image)}>
                            {getFilename(image)}
                          </span>
                        </label>
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <span>{image.product_count} items</span>
                          <span>Sharp: {image.quality ? image.quality.sharpness.toFixed(0) : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400 text-xs">
                No images uploaded yet. Upload shelf photos above to begin review.
              </div>
            )}

            {/* Selected Images Status Callout */}
            {selectedIds.length > 0 && (
              <div
                className={`mt-3 p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                  hasBlurrySelected
                    ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                    : 'bg-[#f5fbf2] border-[#ccebc4] text-[#204130]'
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {hasBlurrySelected ? (
                    <>
                      <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                      <span>
                        <strong>{selectedIds.length} photo(s) selected</strong> — Blurry or low-confidence photo detected.
                        Automatic auto-approval will be safely blocked, requiring human manager sign-off.
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                      <span>
                        <strong>{selectedIds.length} photo(s) selected</strong> — All quality checks clear.
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Active Image Large Preview Canvas */}
          <div className="clay-card p-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="font-semibold text-gray-800">
                {activeImage ? getFilename(activeImage) : 'No Image Selected'}
              </span>
              {activeImage && <time>{new Date(activeImage.observed_at).toLocaleString()}</time>}
            </div>

            <div className="relative aspect-[4/3] max-h-[460px] w-full rounded-2xl overflow-hidden bg-slate-900 border border-[#ccebc4]/80 flex items-center justify-center">
              {activeImage ? (
                <img
                  src={`data:image/jpeg;base64,${
                    showBoundingBoxes ? activeImage.annotated_image : activeImage.original_image || activeImage.annotated_image
                  }`}
                  alt="ShelfMind Analyzed Frame"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-center text-gray-400 space-y-2">
                  <ImageIcon size={36} className="mx-auto text-gray-500" />
                  <p className="text-xs">No shelf image active</p>
                </div>
              )}
            </div>

            {/* Visual Local Detection Telemetry Bento (Calculated locally, independent) */}
            {activeImage && (
              <div className="pt-3 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-900 uppercase tracking-wide">
                    Calculated Local Vision Metrics
                  </span>
                  <span className="text-[11px] font-mono text-[#32664b] bg-[#e7f5e1] px-2 py-0.5 rounded-full">
                    Model: best.onnx (Self-Contained)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-2xl bg-[#FAF9F5] border border-gray-100">
                    <div className="text-xl sm:text-2xl font-extrabold text-gray-900">
                      {activeImage.product_count}
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium">Detections Count</div>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#FAF9F5] border border-gray-100">
                    <div className="text-xl sm:text-2xl font-extrabold text-[#32664b]">
                      {(activeImage.average_confidence * 100).toFixed(1)}%
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium">Mean Confidence</div>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#FAF9F5] border border-gray-100">
                    <div
                      className={`text-xl sm:text-2xl font-extrabold ${
                        activeImage.quality && activeImage.quality.sharpness < activeImage.quality.blur_threshold
                          ? 'text-amber-600'
                          : 'text-gray-900'
                      }`}
                    >
                      {activeImage.quality ? activeImage.quality.sharpness.toFixed(1) : 'N/A'}
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium">
                      Sharpness (Min: {activeImage.quality?.blur_threshold ?? 60})
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#FAF9F5] border border-gray-100">
                    <div className="text-xl sm:text-2xl font-extrabold text-gray-900">
                      {activeImage.quality ? `${activeImage.quality.image_coverage_percent.toFixed(1)}%` : 'N/A'}
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium">Shelf Coverage Area</div>
                  </div>
                </div>

                {/* Quality verdict banner */}
                <div
                  className={`p-3 rounded-xl text-xs flex items-center justify-between gap-3 ${
                    activeImage.quality?.status === 'CLEAR'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border border-amber-200 text-amber-800'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    {activeImage.quality?.status === 'CLEAR' ? (
                      <CheckCircle2 size={15} className="text-emerald-600" />
                    ) : (
                      <AlertTriangle size={15} className="text-amber-600" />
                    )}
                    {activeImage.quality
                      ? activeImage.quality.reasons.join(' • ') || 'Image sharpness clear. Ready for item verification.'
                      : 'Quality heuristic pending.'}
                  </span>
                  <span className="font-mono text-[10px] text-gray-500">
                    Exposure: {activeImage.quality?.brightness.toFixed(0)}/255
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Item Verification & MDP Policy (Span 5) */}
        <section className="lg:col-span-5 space-y-5" aria-label="Item identification and MDP policy">
          {/* Step 2 & 3: Item ID & Verified Quantity */}
          <div className="clay-card p-6 space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e7f5e1] text-[#204130] text-xs font-bold uppercase mb-2">
                <span>Step 2 & 3</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900">Item Verification</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Associate detected objects with an Item ID and confirm total stock count for MDP evaluation.
              </p>
            </div>

            <form onSubmit={handleEvaluate} className="space-y-4">
              {/* Product Select */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Select Item ID
                </label>
                <select
                  required
                  value={productId}
                  disabled={busy || uploading}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    setQuantity('');
                    invalidate();
                    setError('');
                  }}
                  className="w-full min-h-11 px-3 py-2 rounded-xl border border-[#ccebc4] bg-white text-sm focus:ring-2 focus:ring-[#32664b] focus:border-[#32664b]"
                >
                  <option value="">-- Choose Item ID --</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.id} — {product.name} ({product.currentStock} units in DB)
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity Input with Quick Fill */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-700">
                    Verified Total Available Units
                  </label>
                  {activeImage && activeImage.product_count > 0 && (
                    <button
                      type="button"
                      onClick={handleUseDetectionCount}
                      className="text-[11px] font-semibold text-[#32664b] hover:underline flex items-center gap-1"
                    >
                      Use detected count ({activeImage.product_count})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  required
                  min={0}
                  step={1}
                  max={history?.capacity ?? 250}
                  value={quantity}
                  disabled={busy || uploading}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    invalidate();
                  }}
                  placeholder="Enter verified count"
                  className="w-full min-h-11 px-3 py-2 rounded-xl border border-[#ccebc4] bg-white text-sm focus:ring-2 focus:ring-[#32664b] focus:border-[#32664b]"
                />
                {history && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    Item capacity: {history.capacity} units • MOQ: {assessment?.minimumOrderQuantity ?? 8}
                  </p>
                )}
              </div>

              {/* Confirmation Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FAF9F5] border border-gray-100 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={verified}
                  disabled={busy || uploading}
                  onChange={(e) => setVerified(e.target.checked)}
                  className="mt-0.5 rounded text-[#32664b] focus:ring-[#32664b]"
                />
                <span>
                  I confirm that I have verified the available quantity for <strong>{productId || 'this item'}</strong> across
                  all selected shelf photos.
                </span>
              </label>

              {/* Primary Evaluation Action */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    type="submit"
                    disabled={
                      busy ||
                      uploading ||
                      historyLoading ||
                      !history ||
                      !verified ||
                      !selectedIds.length ||
                      quantity === ''
                    }
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#32664b] hover:bg-[#204130] text-white text-sm font-semibold shadow-clay-button hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busy ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                    <span>{busy ? 'Solving Bellman MDP...' : 'Evaluate with MDP'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentTab('settings')}
                    className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 font-medium"
                  >
                    <Settings2 size={14} />
                    <span>
                      {settings.autonomyMode === 'AUTO_UNDER_THRESHOLD' ? 'Auto-Approval ON' : 'Human Review Mode'}
                    </span>
                  </button>
                </div>

                {/* Validation Guidance Hint */}
                {(!verified || !selectedIds.length || quantity === '') && (
                  <p className="text-[11px] text-[#28523c]/80 bg-[#f5fbf2] p-2 rounded-lg border border-[#ccebc4]/60 flex items-center gap-1.5">
                    <span className="font-semibold">To evaluate:</span>
                    {!selectedIds.length
                      ? 'Select at least 1 photo above'
                      : quantity === ''
                      ? 'Enter or confirm the verified quantity'
                      : !verified
                      ? 'Check the confirmation checkbox above'
                      : ''}
                  </p>
                )}
              </div>
            </form>

            {historyLoading && (
              <div className="p-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin text-[#32664b]" />
                <span>Loading product demand history and MDP parameters...</span>
              </div>
            )}
          </div>

          {/* Step 4: MDP Evaluation Decision (MORE / LESS / OPTIMAL) */}
          {decision && assessment && (
            <div className="clay-card p-6 space-y-5 border border-[#ccebc4]">
              {/* Prominent Verdict Card */}
              <div
                className={`p-5 rounded-2xl border ${
                  decision.action === 'BUY'
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : decision.action === 'REDUCE'
                    ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                    : 'bg-teal-50/80 border-teal-200 text-teal-950'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {decision.action === 'BUY'
                      ? 'NEED MORE (Low Stock)'
                      : decision.action === 'REDUCE'
                      ? 'NEED LESS (Overstock)'
                      : 'STOCK IS OPTIMAL'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/90 shadow-sm">
                    {statusLabel(decision.status)}
                  </span>
                </div>

                <h3 className="text-2xl font-black tracking-tight">
                  {decision.action === 'BUY'
                    ? `ORDER +${decision.quantity} UNITS`
                    : decision.action === 'REDUCE'
                    ? 'HOLD REPLENISHMENT'
                    : 'HOLD POLICY (No Order)'}
                </h3>

                <p className="text-xs mt-2 leading-relaxed opacity-90">{decision.reason}</p>
              </div>

              {/* MDP Summary Metrics */}
              <div className="grid grid-cols-2 gap-3 text-left text-xs">
                <div className="p-3 bg-[#FAF9F5] rounded-xl border border-gray-100">
                  <div className="text-gray-500">Verified Stock</div>
                  <div className="text-base font-bold text-gray-900 mt-0.5">{decision.currentStock} units</div>
                </div>
                <div className="p-3 bg-[#FAF9F5] rounded-xl border border-gray-100">
                  <div className="text-gray-500">Optimal MDP Target</div>
                  <div className="text-base font-bold text-[#32664b] mt-0.5">{assessment.targetQuantity} units</div>
                </div>
                <div className="p-3 bg-[#FAF9F5] rounded-xl border border-gray-100">
                  <div className="text-gray-500">Average Daily Demand</div>
                  <div className="text-base font-bold text-gray-900 mt-0.5">{assessment.dailyDemand} / day</div>
                </div>
                <div className="p-3 bg-[#FAF9F5] rounded-xl border border-gray-100">
                  <div className="text-gray-500">Estimated Spend</div>
                  <div className="text-base font-bold text-gray-900 mt-0.5">
                    {formatMoney(decision.imageReview?.estimatedSpend || 0)}
                  </div>
                </div>
              </div>

              {/* Safety Guardrails Checklist */}
              <details className="text-xs bg-[#FAF9F5] p-3.5 rounded-2xl border border-gray-100">
                <summary className="font-bold text-gray-800 cursor-pointer flex items-center justify-between">
                  <span>Safety Guardrails Checklist ({decision.imageReview?.autoChecks.filter((c) => c.passed).length || 0}/8 Passed)</span>
                  <span className="text-[11px] text-[#32664b] font-normal">Inspect</span>
                </summary>
                <ul className="mt-3 space-y-2 pt-2 border-t border-gray-200/60">
                  {decision.imageReview?.autoChecks.map((check) => (
                    <li key={check.label} className="flex items-center gap-2">
                      {check.passed ? (
                        <Check size={14} className="text-emerald-600 shrink-0" />
                      ) : (
                        <X size={14} className="text-rose-600 shrink-0" />
                      )}
                      <span className={check.passed ? 'text-gray-700' : 'text-rose-700 font-semibold'}>
                        {check.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>

              {/* Manager Approval Actions */}
              {decision.status === 'APPROVAL_REQUIRED' && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      disabled={busy}
                      onClick={() => void handleDecisionAction('approve')}
                      className="flex-1 min-h-11 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#32664b] hover:bg-[#204130] text-white text-xs font-bold shadow-clay-button transition"
                    >
                      <Check size={15} />
                      Approve Recommendation
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setActionMode('modify');
                        setActionQuantity(String(decision.quantity));
                        setReason('');
                      }}
                      className="px-4 py-2.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition flex items-center gap-1.5"
                    >
                      <Pencil size={13} /> Adjust
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setActionMode('reject');
                        setReason('');
                      }}
                      className="px-4 py-2.5 rounded-full border border-rose-200 bg-white hover:bg-rose-50 text-xs font-semibold text-rose-700 transition flex items-center gap-1.5"
                    >
                      <X size={13} /> Reject
                    </button>
                  </div>

                  {/* Inline Adjustment Form */}
                  {actionMode && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleDecisionAction(actionMode);
                      }}
                      className="p-4 bg-white rounded-2xl border border-gray-200 space-y-3 mt-2"
                    >
                      <div className="font-bold text-xs text-gray-800">
                        {actionMode === 'modify' ? 'Adjust Order Quantity' : 'Reject Recommendation'}
                      </div>
                      {actionMode === 'modify' && (
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                            New Quantity (Units)
                          </label>
                          <input
                            type="number"
                            required
                            min={0}
                            max={assessment.capacity - decision.currentStock}
                            step={assessment.minimumOrderQuantity}
                            value={actionQuantity}
                            onChange={(e) => setActionQuantity(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border bg-white"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                          Manager Reason / Notes
                        </label>
                        <textarea
                          required
                          maxLength={500}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Provide justification for the audit trail..."
                          className="w-full px-3 py-1.5 text-xs rounded-lg border bg-white h-16"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          disabled={busy || !reason.trim()}
                          className="px-4 py-1.5 rounded-full bg-[#32664b] text-white text-xs font-bold disabled:opacity-40"
                        >
                          Confirm & Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionMode(null)}
                          className="px-3 py-1.5 rounded-full border text-xs text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {decision.status === 'AUTO_EXECUTED' && (
                <div className="p-3 bg-[#e7f5e1] rounded-xl border border-[#ccebc4] text-xs text-[#204130] flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#32664b]" />
                  <span>
                    <strong>Auto-Approved:</strong> Order recommendation logged and verified under store guardrails.
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Individual Product Graphs & Mathematical Evidence (Based on Item ID) */}
      {history && (
        <section className="clay-card p-6 space-y-6" aria-label="Individual product evidence graphs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <div className="text-xs uppercase font-bold tracking-widest text-[#32664b] mb-1">
                Individual Product Evidence
              </div>
              <h2 className="text-xl font-extrabold text-gray-900">
                {productId} — {history.name}
              </h2>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-[#f5fbf2] border border-[#ccebc4] text-[#28523c] rounded-full">
              {history.historyGenerated ? 'Simulated Demand Reference' : 'Imported Retail History'}
              {history.history.length ? ` • Through ${history.history[history.history.length - 1].date}` : ''}
            </span>
          </div>

          {/* Product Time Series Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProductHistoryChart
              title="Historical Demand vs Recorded Sales"
              rows={history.history.map((row) => ({
                label: row.date.slice(5),
                values: { demand: row.demand, sold: row.sold },
              }))}
              series={[
                { key: 'demand', label: 'Daily Demand', color: '#375B42' },
                { key: 'sold', label: 'Units Sold', color: '#277B98' },
              ]}
            />

            <ProductHistoryChart
              title="Verified Stock Checks vs Optimal MDP Target"
              rows={history.reviews
                .slice(0, 20)
                .reverse()
                .map((row) => ({
                  label: new Date(row.timestamp).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  values: {
                    stock: row.currentStock,
                    target: row.imageReview?.assessment.targetQuantity ?? row.currentStock,
                  },
                }))}
              series={[
                { key: 'stock', label: 'Verified Quantity', color: '#277B98' },
                { key: 'target', label: 'Optimal Target', color: '#B97731' },
              ]}
            />
          </div>

          {/* MDP Action Value Comparison Bar Chart */}
          {assessment && (
            <div className="p-5 bg-[#FAF9F5] rounded-2xl border border-gray-200/80 space-y-4 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 size={16} className="text-[#32664b]" />
                    <span>MDP Bellman Action Evaluation (Q-Values)</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Comparison of expected cumulative discounted reward across candidate order quantities.
                  </p>
                </div>
                <span className="font-mono text-xs text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full font-semibold">
                  {assessment.converged ? 'Policy Converged' : 'Iterating'} (γ = {assessment.discount})
                </span>
              </div>

              {/* Action Bars */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 pt-2">
                {assessment.actions.slice(0, 8).map((action) => {
                  const values = assessment.actions.map((r) => r.value);
                  const min = Math.min(...values);
                  const max = Math.max(...values);
                  const percent = max === min ? 100 : Math.max(4, ((action.value - min) / (max - min)) * 100);
                  const isChosen = action.quantity === assessment.orderQuantity;

                  return (
                    <div key={action.quantity} className="space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className={`font-semibold ${isChosen ? 'text-[#32664b]' : 'text-gray-700'}`}>
                          {action.quantity ? `Buy ${action.quantity} units` : 'Hold (0 units)'}
                          {isChosen && <span className="ml-1.5 text-[10px] font-bold text-emerald-700">★ Optimal</span>}
                        </span>
                        <span className="tabular-nums font-mono text-gray-500">{action.value.toFixed(2)} pts</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isChosen ? 'bg-[#32664b]' : 'bg-[#81AEB9]'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 text-[11px] text-gray-500 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200/60">
                <span>
                  Estimated Stockout Probability: {(assessment.stockoutProbability * 100).toFixed(1)}% • Lead Time:{' '}
                  {assessment.leadTimeDays} days
                </span>
                <span>Algorithm: Value Iteration / Empirical Lead-Time Windows</span>
              </div>
            </div>
          )}

          {/* Past Reviews List */}
          {history.reviews.length > 0 && (
            <details className="text-xs pt-2">
              <summary className="font-bold text-gray-700 cursor-pointer hover:text-gray-900">
                View Past Image Reviews for this Item ({history.reviews.length})
              </summary>
              <div className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
                {history.reviews.slice(0, 10).map((rev) => (
                  <button
                    key={rev.id}
                    onClick={() => {
                      setDecision(rev);
                      setActionMode(null);
                    }}
                    className="w-full py-2.5 flex items-center justify-between text-left hover:bg-gray-50 px-2 rounded-lg transition"
                  >
                    <span className="font-medium text-gray-800">
                      {new Date(rev.timestamp).toLocaleString()} • {rev.currentStock} verified units
                    </span>
                    <span className="font-semibold text-[#32664b]">{statusLabel(rev.status)}</span>
                  </button>
                ))}
              </div>
            </details>
          )}
        </section>
      )}
    </div>
  );
};
