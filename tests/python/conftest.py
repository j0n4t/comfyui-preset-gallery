"""ComfyUI host stubs and import path for the Python suite.

`preset_gallery.py` imports aiohttp and ComfyUI's `server` module at module
scope, so it cannot be imported on its own — the same host-coupling the JS side
had with scripts/app.js. Both are stubbed here so the suite runs in a bare
environment (`uv run --with pytest pytest`) with no ComfyUI install.

`server` is a script in ComfyUI's root rather than an installed package, so it
is only importable when that root is on sys.path. Stubbing avoids depending on
where ComfyUI happens to live.

The stubs are deliberately minimal: a route table that records the decorators
`preset_gallery` applies at import time, and a json_response pass-through.
Whether ComfyUI actually calls these hooks is the live smoke test's job.
"""

import os
import sys
import types

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)


class StubRoutes:
    """Stands in for ComfyUI's aiohttp route table."""

    def __init__(self):
        self.registered = {"GET": [], "POST": [], "DELETE": []}

    def _register(self, method, path, fn):
        self.registered[method].append((path, fn))
        return fn

    def get(self, path):
        def decorator(fn):
            return self._register("GET", path, fn)
        return decorator

    def post(self, path):
        def decorator(fn):
            return self._register("POST", path, fn)
        return decorator

    def delete(self, path):
        def decorator(fn):
            return self._register("DELETE", path, fn)
        return decorator


def _install_host_stubs():
    if "aiohttp" not in sys.modules:
        aiohttp = types.ModuleType("aiohttp")
        aiohttp.web = types.SimpleNamespace(
            json_response=lambda *a, **k: {"json": a, "kwargs": k}
        )
        sys.modules["aiohttp"] = aiohttp

    if "server" not in sys.modules:
        server = types.ModuleType("server")
        server.PromptServer = types.SimpleNamespace(
            instance=types.SimpleNamespace(routes=StubRoutes())
        )
        sys.modules["server"] = server


_install_host_stubs()


@pytest.fixture(scope="session")
def host_routes():
    """The route table `preset_gallery` registered its endpoints on."""
    return sys.modules["server"].PromptServer.instance.routes
