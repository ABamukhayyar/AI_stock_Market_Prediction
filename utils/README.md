# `utils/` — small helpers

## File

- `seed.py` — `set_seed(seed: int = 42)` seeds Python `random`, NumPy,
  TensorFlow, and `PYTHONHASHSEED`, plus enables TF op-determinism when
  available. Called once at the top of [`train_model.py`](../train_model.py),
  [`train_linear.py`](../train_linear.py), [`predict.py`](../predict.py), and
  [`evaluate.py`](../evaluate.py) before any model imports happen.

## Why this exists

A reproducibility audit found that the project had no seeded RNG anywhere — so
every training run produced different weights and headline metrics could not
be reproduced. This helper, called from every entry point, fixes that.

```python
# At the top of every script, BEFORE importing tensorflow / numpy work:
from utils.seed import set_seed
set_seed(42)
```
