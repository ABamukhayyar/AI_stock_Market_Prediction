"""Execute notebooks/01_eda.ipynb in-place using nbformat + ExecutePreprocessor.

Avoids nbconvert CLI Windows-path quirks.
"""
import os
from pathlib import Path

import nbformat
from nbconvert.preprocessors import ExecutePreprocessor

HERE = Path(__file__).parent.resolve()
NOTEBOOK = HERE / "01_eda.ipynb"

print(f"Reading {NOTEBOOK}")
nb = nbformat.read(NOTEBOOK, as_version=4)

ep = ExecutePreprocessor(timeout=600, kernel_name="python3")

# Execute with cwd = the notebook's folder so relative paths (eda_outputs/) work.
os.chdir(HERE)
print(f"Executing notebook (cwd={HERE}) ...")
ep.preprocess(nb, {"metadata": {"path": str(HERE)}})

nbformat.write(nb, NOTEBOOK)
print(f"Wrote executed notebook back to {NOTEBOOK}")
