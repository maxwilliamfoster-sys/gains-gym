"""Frame receiver for tools/video_thumb.js: saves POSTed data-URL frames to a folder.

    py tools/receive_frames.py <out_dir> [port]

POST /0001 with a data URL body  ->  <out_dir>/frame_0001.jpg (or .png)
POST /done                       ->  shuts the server down
"""
import base64, pathlib, sys, threading
from http.server import BaseHTTPRequestHandler, HTTPServer

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "frames")
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8652
OUT.mkdir(parents=True, exist_ok=True)


class H(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
        self.send_response(204); self.send_header("Access-Control-Allow-Origin", "*"); self.end_headers()
        name = self.path.strip("/")
        if name == "done":
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        head, data = body.split(",", 1)
        ext = "png" if "png" in head else "jpg"
        (OUT / f"frame_{int(name):04d}.{ext}").write_bytes(base64.b64decode(data))

    def log_message(self, *a):
        pass


HTTPServer(("127.0.0.1", PORT), H).serve_forever()
print("receiver stopped", flush=True)
