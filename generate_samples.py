import os

# Define the target directory matching preset_gallery.py's configuration
POOL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "presets_pool")
os.makedirs(POOL_DIR, exist_ok=True)

# 20 curated sample presets organized across various subfolders
SAMPLES = {
    # Core Photographic Styles
    "styles/cinematic_lighting": "cinematic lighting, dramatic shadows, moody atmosphere, volumetric god rays, 8k resolution",
    "styles/vintage_analog": "vintage analog photo, 35mm film grain, faded colors, subtle light leaks, retro aesthetic",
    "styles/cyberpunk_neon": "cyberpunk aesthetic, glowing neon lights, rain-slicked streets, high contrast, vibrant purple and teal cyan colors",
    "styles/minimalist_clean": "minimalist design, studio white backdrop, clean lines, soft diffused corporate lighting, high-end commercial style",
    "styles/dark_fantasy": "dark fantasy vibe, gothic architecture, eerie mist, ominous moonlight, intricate macabre details",

    # Camera & Shot Types
    "camera/macro_extreme": "extreme macro close-up shot, shallow depth of field, sharp focus, microscopic details visible",
    "camera/wide_drone_angle": "wide-angle aerial drone photography, bird's-eye view, sweeping landscape, expansive perspective",
    "camera/fisheye_distortion": "fisheye lens distortion, ultra-wide perspective, warped edges, dynamic action framing",
    "camera/portrait_bokeh": "85mm focal length bokeh portrait, blurred background creaminess, sharp focus on eyes, professional headshot",

    # Digital & Traditional Art Mediums
    "mediums/watercolor_wash": "soft watercolor painting, bleeding ink washes, hand-drawn paper texture, pastel color palette",
    "mediums/oil_canvas_impasto": "thick impasto oil painting texture, visible palette knife strokes, rich oil canvas paint layers",
    "mediums/retro_pixel_art": "16-bit retro pixel art game sprite layout, clean grid lines, limited color palette, nostalgic shading",
    "mediums/vector_flat_illustration": "flat vector illustration, minimal shading, clean SVGs shapes, vibrant pop colors, modern graphic design",

    # Architectural & Environmental Settings
    "environments/brutalist_concrete": "brutalist architecture style, raw concrete textures, monolithic structures, geometric shadows",
    "environments/biophilic_greenhouse": "biophilic design interior, solarium greenhouse, lush tropical plants cascading, sun-drenched glass panels",
    "environments/steampunk_workshop": "steampunk laboratory workshop, brass gears turning, copper pipes hiss, dim amber Edison bulb illumination",

    # Character Attributes & Wardrobe
    "characters/stealth_cyber_ninja": "wearing sleek tactical stealth cyber ninja armor, matte black plating, glowing LED visor visor accents",
    "characters/royal_baroque_gown": "wearing an ornate royal baroque gown, intricate gold embroidery thread, heavy velvet fabric, historical regality",
    
    # Root Category Presets (to demonstrate loose, un-grouped layout behaviors)
    "hyper_detailed_enhancer": "hyper-detailed textures, highly intricate filigree lines, masterpiece quality composition, flawless render",
    "surreal_dreamscape": "surreal dreamscape environment, floating islands, liquid sky physics, gravity-defying architecture, ethereal color shifts"
}

def generate_samples():
    print(f"🚀 Initializing sample generation inside: {POOL_DIR}")
    created_count = 0
    
    for relative_path, text_content in SAMPLES.items():
        # Construct path dynamically supporting nested subfolder patterns
        target_txt_file = os.path.join(POOL_DIR, f"{relative_path}.txt")
        
        # Ensure parent subfolders are fully provisioned dynamically
        os.makedirs(os.path.dirname(target_txt_file), exist_ok=True)
        
        with open(target_txt_file, "w", encoding="utf-8") as f:
            f.write(text_content)
        
        print(f"  [+] Created: {relative_path}.txt")
        created_count += 1
        
    print(f"\n✨ Success! Generated {created_count} samples across multiple nested categories.")
    print("👉 Refresh your ComfyUI browser tab to inspect your populated Preset Gallery!")

if __name__ == "__main__":
    generate_samples()