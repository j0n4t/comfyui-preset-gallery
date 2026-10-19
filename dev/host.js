// Stand-in for ComfyUI's host module (ComfyUI/scripts/app.js).
//
// The real one is a shim: `export const app = window.comfyAPI.app.app;`. The
// frontend bundle assigns window.comfyAPI.app.app before extension modules
// load, so this reproduces that contract rather than inventing a new one.
// Nothing else about the app is faked - the harness runs the real web/ modules.
const host = {
  __extensions: [],
  canvas: { selected_nodes: {} },
  registerExtension(ext) {
    this.__extensions.push(ext);
    return ext;
  },
};

window.comfyAPI = { app: { app: host } };
export const app = host;
