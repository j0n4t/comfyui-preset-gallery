if __package__:
    from .preset_gallery import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
else:
    # Imported as a bare module rather than as the ComfyUI package. pytest
    # imports the root __init__.py for any tree underneath it, and a bare
    # import cannot resolve the relative import below - but exploding there
    # would error every Python test at setup. The node still registers normally
    # when ComfyUI loads this as a package.
    NODE_CLASS_MAPPINGS = {}
    NODE_DISPLAY_NAME_MAPPINGS = {}

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
