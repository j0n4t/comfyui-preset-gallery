"""The node's output contract.

Kept free of ComfyUI imports so it can be exercised with the standard library
alone; `preset_gallery.py` owns the routes and the node class.
"""


def compose_final_preset(preset_selection, base_preset="", evaluated_preset=""):
    """Join the optional upstream prompt with the gallery's selection.

    `evaluated_preset` is the frontend's expanded form (variants resolved, rolls
    applied) and is preferred when present. `preset_selection` is the fallback
    for workflows saved before that input existed.
    """
    active_preset = evaluated_preset if evaluated_preset.strip() else preset_selection
    parts = [p.strip() for p in [base_preset, active_preset] if p and p.strip()]
    return ", ".join(parts)
