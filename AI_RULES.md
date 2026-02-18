# AI_RULES.md

This repository contains **pyVHR**, a Python framework for remote photoplethysmography (rPPG) / virtual heart-rate estimation.

## Tech stack (quick overview)

- **Language:** Python (environment targets **Python 3.9**; package supports 3.6+ per `setup.py`).
- **Environment management:** Conda environment (`pyVHR_env.yml`) with optional **CUDA** tooling.
- **Deep learning:** **PyTorch** (core DL dependency); **TensorFlow** is present for specific/legacy deep models.
- **GPU acceleration:** NVIDIA **cudatoolkit** plus RAPIDS libraries like **cusignal** (and typically **cupy**) when running on GPU.
- **Signal processing & analysis:** NumPy/SciPy-style workflows (plus domain tools like `biosppy`).
- **Computer vision / face pipeline:** **MediaPipe** (face landmarks/ROI support) and **scikit-image** for image utilities.
- **Data storage:** **HDF5** via `hdf5` + **PyTables**.
- **Visualization:** **Plotly** (plus small utilities for reporting/HTML outputs).
- **UX / demos:** Jupyter-friendly tooling (`ipython`, `ipywidgets`) and optional simple GUI (`PySimpleGUI`).

## Library usage rules (what to use for what)

### 1) Deep learning
- **Prefer PyTorch** for new deep models, training code, and inference utilities.
- **TensorFlow** should only be used when maintaining or running existing TF-based models already in the repo (do not introduce new TF code unless there is a strong compatibility reason).

### 2) GPU vs CPU compute
- When a function supports GPU execution (e.g. via a `cuda=True`/flag):
  - Use **cusignal/cupy**-based implementations for GPU paths.
  - Keep a **CPU fallback** using standard NumPy/SciPy-style operations.
- Do not introduce a new GPU framework unless absolutely necessary (stick to the existing CUDA + RAPIDS stack).

### 3) Signal processing
- Use the project’s existing signal utilities and pipelines first (e.g., modules under `pyVHR/BVP`, `pyVHR/BPM`, `pyVHR/analysis`).
- Use **biosppy** only for biosignal-specific helpers when it reduces code and matches expected outputs.
- Avoid adding “one-off” DSP code in notebooks—promote reusable functionality into the package.

### 4) Computer vision / ROI extraction
- Use **MediaPipe** for face landmarks/face-related ROI extraction when possible.
- Use **scikit-image** for lightweight image processing operations (color transforms, masks, basic filtering).
- Avoid introducing additional CV stacks (e.g., dlib, custom landmark models) unless a dataset/method requires it.

### 5) Data formats and persistence
- Use **HDF5/PyTables** for large intermediate results and repeatable experiment artifacts.
- Prefer simple, explicit serialization (HDF5, JSON, CSV) over custom binary formats.

### 6) Visualization and reporting
- Use **Plotly** for interactive plots and HTML reports.
- Keep plotting code separated from core computation (plotting should not be required to run pipelines).

### 7) Progress, logging, and UX
- Use **tqdm** for progress bars in long-running loops.
- Keep console output controlled by a `verb`/`verbose` flag (default should be quiet).
- Use **PySimpleGUI** only for the existing realtime GUI example; do not add GUI dependencies to core modules.

### 8) Code organization rules
- Put reusable algorithms in their respective modules:
  - BVP extraction/filters/methods: `pyVHR/BVP/`
  - BPM estimation: `pyVHR/BPM/`
  - Experiment pipelines/stats: `pyVHR/analysis/`
  - Dataset adapters: `pyVHR/datasets/`
  - Realtime routines/UI: `pyVHR/realtime/`
- Avoid circular dependencies across these top-level areas.

### 9) Adding new dependencies
- Only add a dependency if it is clearly justified, actively maintained, and reduces complexity.
- Any new dependency must be reflected in the environment setup (Conda/pip lists) and used consistently (no duplicate libs solving the same problem).
