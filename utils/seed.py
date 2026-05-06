"""Reproducibility helper — call set_seed(42) at the top of every entry point."""

import os
import random


def set_seed(seed: int = 42) -> None:
    """Seed Python, NumPy, and TensorFlow for reproducible runs.

    Idempotent. Call once at the very top of train_model.py, evaluate.py,
    predict.py before any model code runs.
    """
    os.environ["PYTHONHASHSEED"] = str(seed)
    random.seed(seed)

    import numpy as np
    np.random.seed(seed)

    try:
        import tensorflow as tf
        tf.random.set_seed(seed)
        # Best-effort op determinism (TF >= 2.8). Safe no-op on older versions.
        try:
            tf.config.experimental.enable_op_determinism()
        except (AttributeError, RuntimeError):
            pass
    except ImportError:
        pass

    print(f"[seed] all RNGs seeded with {seed}")
