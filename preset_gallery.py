class PresetGalleryNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "preset_selection": ("STRING", {"default": "", "multiline": True})
            },
            "optional": {
                "base_preset": ("STRING", {"forceInput": True, "default": ""})
            }
        }
    
    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("final_preset",)
    FUNCTION = "get_preset"
    CATEGORY = "utils"
    
    def get_preset(self, preset_selection, base_preset=""):
        parts = [p.strip() for p in [base_preset, preset_selection] if p and p.strip()]
        final_preset = ", ".join(parts)
        return (final_preset,)

NODE_CLASS_MAPPINGS = {
    "PresetGalleryNode": PresetGalleryNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PresetGalleryNode": "Preset Gallery"
}