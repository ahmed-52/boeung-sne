# backend/services/birdnet.py
import io
from typing import List, Tuple, Optional, Dict, Any

import numpy as np
import soundfile as sf
import librosa


from tensorflow.lite.python.interpreter import Interpreter


class BirdNETService:
    """
    BirdNET inference service:
      - infers model's required input length (N samples)
      - infers target sample rate as N / 3 sec
      - windowizes long audio into 3s chunks with overlap
      - averages logits over windows, then applies sigmoid
      - returns top_k species; can also return best segment per species
    """

    def __init__(
        self,
        model_path: str = "models/birdnet/audio-model.tflite",
        labels_path: str = "models/birdnet/labels/en_us.txt",
        window_sec: float = 3.0,
    ):
        print("[BirdNET] Loading model:", model_path, flush=True)
        self.interpreter = Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()

        # Expect input like [1, N]
        in_shape = self.input_details[0]["shape"]
        self.expected_len = int(in_shape[1])
        self.window_sec = float(window_sec)
        # infer SR from expected_len / window_sec
        self.target_sr = int(round(self.expected_len / self.window_sec))
        print(
            f"[BirdNET] Input shape: {in_shape} -> expected_len={self.expected_len}, "
            f"target_sr={self.target_sr} Hz for {self.window_sec}s window",
            flush=True,
        )

        print("[BirdNET] Loading labels from:", labels_path, flush=True)
        self.labels = self._load_labels(labels_path)
        print(f"[BirdNET] Loaded {len(self.labels)} labels.", flush=True)

    # -------------------- helpers --------------------

    def _load_labels(self, path: str) -> List[str]:
        with open(path, "r", encoding="utf-8") as f:
            return [ln.strip() for ln in f if ln.strip()]

    def _read_and_resample(self, file_bytes: bytes) -> np.ndarray:
        """Read audio bytes, mono-ize, resample to target_sr."""
        y, sr = sf.read(io.BytesIO(file_bytes), dtype="float32", always_2d=False)
        if y.ndim > 1:
            y = np.mean(y, axis=1)
        if sr != self.target_sr:
            y = librosa.resample(y=y, orig_sr=sr, target_sr=self.target_sr)
        return y.astype("float32", copy=False)

    def _windowize(
        self, y: np.ndarray, expected_len: int, overlap: float
    ) -> Tuple[np.ndarray, List[Tuple[float, float]]]:
        """
        Slice audio into windows of length expected_len with given overlap in [0,1).
        Returns:
          X: [num_windows, expected_len]
          segments: list of (start_sec, end_sec) per window
        """
        hop = int(expected_len * max(1e-6, (1.0 - overlap)))
        if hop <= 0:
            hop = 1

        n = len(y)
        windows = []
        segments = []

        if n <= expected_len:
            pad = expected_len - n
            if pad > 0:
                yp = np.pad(y, (0, pad))
            else:
                yp = y
            windows.append(yp)
            segments.append((0.0, expected_len / self.target_sr))
            return np.stack(windows), segments

        start = 0
        while start < n:
            end = start + expected_len
            chunk = y[start:end]
            if len(chunk) < expected_len:
                chunk = np.pad(chunk, (0, expected_len - len(chunk)))
            windows.append(chunk)
            seg_start = start / self.target_sr
            seg_end = seg_start + expected_len / self.target_sr
            segments.append((seg_start, seg_end))
            if end >= n:
                break
            start += hop

        return np.stack(windows), segments

    def _infer_window(self, win: np.ndarray) -> np.ndarray:
        """Run model on a single window [N] -> logits [C]."""
        x = win[None, :]  # [1, N]
        self.interpreter.set_tensor(self.input_details[0]["index"], x)
        self.interpreter.invoke()
        logits = self.interpreter.get_tensor(self.output_details[0]["index"])[0]
        return logits



    def predict(
        self,
        file_bytes: bytes,
        top_k: int = 5,
        overlap: float = 0.5,
        min_conf: float = 0.1,
        return_segments: bool = False,
    ) -> Dict[str, Any]:
        """
        Run full-file inference with windowing.
        Returns:
          {
            "top_k": [{index,label,score, segment?}, ...],
            "num_classes": int,
          }
        """

        y = self._read_and_resample(file_bytes)


        X, segments = self._windowize(y, self.expected_len, overlap)

       
        num_classes: Optional[int] = None
        logits_sum = None
        all_probs = []  

        for i, win in enumerate(X):
            logits = self._infer_window(win).astype(np.float64)
            if num_classes is None:
                num_classes = logits.shape[0]
            if logits_sum is None:
                logits_sum = logits
            else:
                logits_sum += logits

            probs = 1.0 / (1.0 + np.exp(-logits))
            all_probs.append(probs.astype(np.float32))


        logits_avg = logits_sum / len(X)
        probs_avg = 1.0 / (1.0 + np.exp(-logits_avg))

     
        order = np.argsort(probs_avg)[::-1]
        results = []
        for cls in order:
            p = float(probs_avg[cls])
            if p < min_conf and len(results) >= top_k:
            
                break

            label = self.labels[cls] if cls < len(self.labels) else f"class_{cls}"
            item = {"index": int(cls), "label": label, "score": p}

            if return_segments:
                # find best window (time) for this class
                best_idx = int(np.argmax([pw[cls] for pw in all_probs]))
                seg = segments[best_idx]
                item["best_segment"] = {"start_sec": seg[0], "end_sec": seg[1], "window_index": best_idx}

            if p >= min_conf or len(results) < top_k:
                results.append(item)
            if len(results) >= top_k:
                break

        if not results:
            top = order[:top_k]
            for cls in top:
                label = self.labels[cls] if cls < len(self.labels) else f"class_{cls}"
                p = float(probs_avg[cls])
                item = {"index": int(cls), "label": label, "score": p}
                if return_segments:
                    best_idx = int(np.argmax([pw[cls] for pw in all_probs]))
                    seg = segments[best_idx]
                    item["best_segment"] = {"start_sec": seg[0], "end_sec": seg[1], "window_index": best_idx}
                results.append(item)

        return {"top_k": results, "num_classes": int(num_classes or len(self.labels))}
